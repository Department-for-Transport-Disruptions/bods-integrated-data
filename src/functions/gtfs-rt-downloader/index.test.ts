import * as utilFunctions from "@bods-integrated-data/shared/gtfs-rt/utils";
import { logger } from "@bods-integrated-data/shared/logger";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
            getPresignedUrl: vi.fn(),
            execute: vi.fn(),
            destroy: vi.fn(),
            mockDbClient: {
                destroy: vi.fn(),
            },
        };
    });

    vi.mock("@bods-integrated-data/shared/cloudwatch");

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
        getPresignedUrl: mocks.getPresignedUrl,
    }));

    vi.mock("@bods-integrated-data/shared/database", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/database")>()),
        getDatabaseClient: vi.fn().mockReturnValue(mocks.mockDbClient),
    }));

    const getAvlDataForGtfsMock = vi.spyOn(utilFunctions, "getAvlDataForGtfs");
    const base64EncodeMock = vi.spyOn(utilFunctions, "base64Encode");

    const mockBucketName = "mock-bucket";
    let mockRequest: APIGatewayProxyEvent;

    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
        mockRequest = {} as APIGatewayProxyEvent;
    });

    afterEach(() => {
        vi.clearAllMocks();
        getAvlDataForGtfsMock.mockReset();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        const response = await handler(mockRequest);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the GTFS-RT downloader endpoint",
            expect.any(Error),
        );
    });

    describe("fetching GTFS-RT in-place", () => {
        it("returns a 200 with GTFS-RT in-place", async () => {
            mocks.getS3Object.mockResolvedValue({ Body: { transformToString: () => Promise.resolve("test") } });

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test",
                isBase64Encoded: true,
            });

            expect(mocks.getS3Object).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when no GTFS-RT data can be found", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: undefined });

            const response = await handler(mockRequest);
            expect(response).toEqual({
                statusCode: 500,
                body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
            });
            expect(logger.error).toHaveBeenCalledWith(
                "There was a problem with the GTFS-RT downloader endpoint",
                expect.any(Error),
            );
        });
    });

    describe("downloading GTFS-RT", () => {
        it("returns a 302 with a GTFS-RT download link when the download query param is true", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs-rt.json?hello=world`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            mockRequest.queryStringParameters = {
                download: "true",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
                body: "",
            });

            expect(mocks.getPresignedUrl).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" }, 3600);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns the GTFS-RT data in-place when the download query param is not true", async () => {
            mocks.getS3Object.mockResolvedValue({ Body: { transformToString: () => Promise.resolve("test") } });

            mockRequest.queryStringParameters = {
                download: "random",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test",
                isBase64Encoded: true,
            });

            expect(mocks.getS3Object).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when a download link cannot be generated", async () => {
            mocks.getPresignedUrl.mockRejectedValueOnce(new Error());

            mockRequest.queryStringParameters = {
                download: "true",
            };

            const response = await handler(mockRequest);
            expect(response).toEqual({
                statusCode: 500,
                body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
            });
            expect(logger.error).toHaveBeenCalledWith(
                "There was a problem with the GTFS-RT downloader endpoint",
                expect.any(Error),
            );
        });
    });

    describe("filter GTFS-RT", () => {
        it.each([
            [
                { boundingBox: "asdf" },
                "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
            ],
            [
                { boundingBox: "34.5,56.7,-34.697" },
                "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
            ],
            [
                { boundingBox: "34.5,56.7,-34.697,-19.0,33.333" },
                "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
            ],
            [
                { routeId: "asdf123!@£" },
                "routeId must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
            [
                { routeId: "1," },
                "routeId must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
            [{ startTimeBefore: "asdf123!@£" }, "startTimeBefore must be a number"],
            [{ startTimeAfter: "asdf123!@£" }, "startTimeAfter must be a number"],
        ])("returns a 400 when the %o query param fails validation", async (params, expectedErrorMessage) => {
            mockRequest.queryStringParameters = params;
            const response = await handler(mockRequest);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: [expectedErrorMessage] }),
            });
            expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
            expect(getAvlDataForGtfsMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the routeId query param is a number", async () => {
            getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockRequest.queryStringParameters = {
                routeId: "1",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test-base64",
                isBase64Encoded: true,
            });

            expect(getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                "1",
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the routeId query param is an array of numbers", async () => {
            getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockRequest.queryStringParameters = {
                routeId: "1,2,3",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test-base64",
                isBase64Encoded: true,
            });

            expect(getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                "1,2,3",
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the startTimeBefore query param is a number", async () => {
            getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockRequest.queryStringParameters = {
                startTimeBefore: "123",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test-base64",
                isBase64Encoded: true,
            });

            expect(getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                123,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the startTimeAfter query param is a number", async () => {
            getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockRequest.queryStringParameters = {
                startTimeAfter: "123",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test-base64",
                isBase64Encoded: true,
            });

            expect(getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                123,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the boundingBox query param is 4 numbers", async () => {
            getAvlDataForGtfsMock.mockResolvedValueOnce([]);
            base64EncodeMock.mockReturnValueOnce("test-base64");

            mockRequest.queryStringParameters = {
                boundingBox: "1,2,3,4",
            };

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test-base64",
                isBase64Encoded: true,
            });

            expect(getAvlDataForGtfsMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                "1,2,3,4",
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when an unexpected error occurs", async () => {
            getAvlDataForGtfsMock.mockRejectedValueOnce(new Error("Database fetch error"));

            mockRequest.queryStringParameters = {
                routeId: "1",
            };

            const response = await handler(mockRequest);
            expect(response).toEqual({
                statusCode: 500,
                body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
            });
            expect(logger.error).toHaveBeenCalledWith(
                "There was a problem with the GTFS-RT downloader endpoint",
                expect.any(Error),
            );
        });
    });
});
