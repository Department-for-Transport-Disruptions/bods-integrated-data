import * as utilFunctions from "@bods-integrated-data/shared/gtfs-rt/utils";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
            execute: vi.fn(),
            destroy: vi.fn(),
            mockDbClient: {
                destroy: vi.fn(),
            },
            getAvlDataForGtfsMock: vi.fn(),
        };
    });

    vi.mock("@bods-integrated-data/shared/cloudwatch");

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
    }));

    vi.mock("@bods-integrated-data/shared/database", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/database")>()),
        getDatabaseClient: vi.fn().mockReturnValue(mocks.mockDbClient),
    }));

    vi.mock("@bods-integrated-data/shared/gtfs-rt/utils", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/gtfs-rt/utils")>()),
        getAvlDataForGtfs: mocks.getAvlDataForGtfsMock,
    }));

    vi.mock("fs-extra", () => ({
        pathExists: vi.fn().mockResolvedValue(true),
        outputFile: vi.fn(),
        readJson: vi.fn().mockResolvedValue({ value: "123", expiresAt: "12345" }),
        remove: vi.fn(),
    }));

    const base64EncodeMock = vi.spyOn(utilFunctions, "base64Encode");

    const mockBucketName = "mock-bucket";
    let mockEvent: APIGatewayProxyEvent;

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
        mockEvent = {} as APIGatewayProxyEvent;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the GTFS-RT downloader endpoint",
        );
    });

    describe("fetching GTFS-RT in-place", () => {
        it("returns a 200 with GTFS-RT in-place", async () => {
            mocks.getS3Object.mockResolvedValue({ Body: { transformToByteArray: () => Promise.resolve("test") } });

            await handler(mockEvent, mockContext, mockCallback);

            expect(mocks.getS3Object).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when no GTFS-RT data can be found", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: undefined });

            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the GTFS-RT downloader endpoint",
            );
        });
    });

    describe("filter GTFS-RT", () => {
        it.each([
            [
                { boundingBox: "asdf" },
                [
                    "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
                    "boundingBox must use valid numbers",
                ],
            ],
            [
                { boundingBox: "34.5,56.7,-34.697" },
                [
                    "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
                ],
            ],
            [
                { boundingBox: "34.5,56.7,-34.697,-19.0,33.333" },
                [
                    "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
                ],
            ],
            [
                { routeId: "asdf123!@£" },
                [
                    "routeId must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
            ],
            [
                { routeId: "1," },
                [
                    "routeId must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
            ],
            [{ startTimeBefore: "asdf123!@£" }, ["startTimeBefore must be a number"]],
            [{ startTimeAfter: "asdf123!@£" }, ["startTimeAfter must be a number"]],
        ])("returns a 400 when the %o query param fails validation", async (params, expectedErrors) => {
            mockEvent.queryStringParameters = params;
            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
                `[400]: Invalid request - ${expectedErrors.join(", ")}`,
            );

            expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), "Invalid request");
            expect(mocks.getAvlDataForGtfsMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the routeId query param is a number", async () => {
            mocks.getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockEvent.queryStringParameters = {
                routeId: "1",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(mocks.getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                ["1"],
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the routeId query param is an array of numbers", async () => {
            mocks.getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockEvent.queryStringParameters = {
                routeId: "1,2, 3",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(mocks.getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                ["1", "2", "3"],
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the startTimeBefore query param is a number", async () => {
            mocks.getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockEvent.queryStringParameters = {
                startTimeBefore: "123",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(mocks.getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                123,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the startTimeAfter query param is a number", async () => {
            mocks.getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockEvent.queryStringParameters = {
                startTimeAfter: "123",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(mocks.getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                123,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the boundingBox query param is 4 numbers", async () => {
            mocks.getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockEvent.queryStringParameters = {
                boundingBox: "1,2,3,4",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(mocks.getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                [1, 2, 3, 4],
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when an unexpected error occurs", async () => {
            mocks.getS3Object.mockRejectedValueOnce(new Error(""));

            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the GTFS-RT downloader endpoint",
            );
        });
    });
});
