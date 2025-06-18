import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { getDatabaseClient, KyselyDb } from "@bods-integrated-data/shared/database";
import { base64Encode, generateGtfsRtFeed, getAvlDataForGtfs } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            mockDbClient: {
                destroy: vi.fn(),
            } as unknown as KyselyDb,
        };
    });

    vi.mock("@bods-integrated-data/shared/cloudwatch");
    vi.mock("@bods-integrated-data/shared/s3");
    vi.mock("@bods-integrated-data/shared/database");
    vi.mock("@bods-integrated-data/shared/gtfs-rt/utils");

    vi.mock("fs-extra", () => ({
        pathExists: vi.fn().mockResolvedValue(true),
        outputFile: vi.fn(),
        readJson: vi.fn().mockResolvedValue({ value: "123", expiresAt: "12345" }),
        remove: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    }));

    const mockBucketName = "mock-bucket";
    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
        mockEvent = {} as APIGatewayProxyEvent;

        vi.mocked(getDatabaseClient).mockResolvedValue(mocks.mockDbClient);
        vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);
        vi.mocked(base64Encode).mockReturnValue("test-base64");
        vi.mocked(generateGtfsRtFeed).mockReturnValue(new Uint8Array());
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
            vi.mocked(getS3Object).mockResolvedValue({
                Body: { transformToByteArray: () => Promise.resolve("test") },
            } as unknown as GetObjectCommandOutput);

            await handler(mockEvent, mockContext, mockCallback);

            expect(getS3Object).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when no GTFS-RT data can be found", async () => {
            vi.mocked(getS3Object).mockResolvedValue({ Body: undefined } as unknown as GetObjectCommandOutput);

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
            [{ startTimeBefore: "asdf123!@£" }, ["startTimeBefore must be a number"]],
            [{ startTimeAfter: "asdf123!@£" }, ["startTimeAfter must be a number"]],
        ])("returns a 400 when the %o query param fails validation", async (params, expectedErrors) => {
            mockEvent.queryStringParameters = params;
            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
                `[400]: Invalid request - ${expectedErrors.join(", ")}`,
            );

            expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), "Invalid request");
            expect(getAvlDataForGtfs).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the routeId query param is a number", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                routeId: "1",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(getAvlDataForGtfs).toHaveBeenCalledWith(mocks.mockDbClient, [1], undefined, undefined, undefined);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the routeId query param is an array of numbers", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                routeId: "1,2, 3",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(getAvlDataForGtfs).toHaveBeenCalledWith(
                mocks.mockDbClient,
                [1, 2, 3],
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the startTimeBefore query param is a number", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                startTimeBefore: "123",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(getAvlDataForGtfs).toHaveBeenCalledWith(mocks.mockDbClient, undefined, 123, undefined, undefined);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the startTimeAfter query param is a number", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                startTimeAfter: "123",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(getAvlDataForGtfs).toHaveBeenCalledWith(mocks.mockDbClient, undefined, undefined, 123, undefined);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the boundingBox query param is 4 numbers", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                boundingBox: "1,2,3,4",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(getAvlDataForGtfs).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                [1, 2, 3, 4],
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when an unexpected error occurs", async () => {
            vi.mocked(getS3Object).mockRejectedValueOnce(new Error(""));

            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the GTFS-RT downloader endpoint",
            );
        });

        it("strips invalid route ids from request", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                routeId: "abc,1, 2,",
            };

            await handler(mockEvent, mockContext, mockCallback);

            expect(getAvlDataForGtfs).toHaveBeenCalledWith(mocks.mockDbClient, [1, 2], undefined, undefined, undefined);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("throws an error if only invalid routeIds provided", async () => {
            vi.mocked(getAvlDataForGtfs).mockResolvedValue([]);

            mockEvent.queryStringParameters = {
                routeId: "abc,",
            };

            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
                "[400]: Invalid request - routeId must have at least one value",
            );
        });
    });
});
