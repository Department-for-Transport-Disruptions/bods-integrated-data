import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateItemsAndUploadToS3, getTotalVehicleActivites, handler } from ".";
import { testSiri } from "./test/testSiriVm";

describe("bods-siri-vm-analyser", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
            putS3Object: vi.fn(),
        };
    });

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
        putS3Object: mocks.putS3Object,
    }));

    MockDate.set("2024-07-22T12:00:00.000Z");

    beforeAll(() => {
        process.env.STAGE = "local";
        process.env.SIRI_VM_BUCKET_NAME = "test-bucket";
        process.env.ANALYSIS_BUCKET_NAME = "test-bucket";
    });

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe("getTotalVehicleActivities", () => {
        it("gets the correct number of vehicle activities for each operator", () => {
            expect(getTotalVehicleActivites(testSiri)).toStrictEqual({ placeholder: 2, placeholder2: 1 });
        });
    });

    describe("calculateItemsAndUploadToS3", async () => {
        it("calculates the correct values for each operator", async () => {
            const bodsTotal = {
                placeholder: 2,
                placeholder2: 2,
                placeholder3: 1,
            };

            const siriTotal = {
                placeholder: 2,
                placeholder2: 1,
            };

            const expected = {
                placeholder: { oldCount: 2, newCount: 2, absoluteDifference: 0, percentageDifference: 0 },
                placeholder2: { oldCount: 2, newCount: 1, absoluteDifference: 1, percentageDifference: 50 },
                placeholder3: { oldCount: 1, newCount: 0, absoluteDifference: 1, percentageDifference: 100 },
            };

            await calculateItemsAndUploadToS3(bodsTotal, siriTotal, "test-bucket");

            expect(mocks.putS3Object).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "2024-07-22T12:00:00.000Z",
                ContentType: "application/json",
                Body: JSON.stringify(expected),
            });
        });
    });

    describe("handler", () => {
        it("should throw an error if bucket names are not set", async () => {
            process.env.SIRI_VM_BUCKET_NAME = "";
            process.env.ANALYSIS_BUCKET_NAME = "";
            await expect(() => handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
                "Missing env vars: SIRI_VM_BUCKET_NAME and ANALYSIS_BUCKET_NAME must be set.",
            );
        });
    });
});
