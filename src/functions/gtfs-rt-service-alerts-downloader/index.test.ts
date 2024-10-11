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

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
        getPresignedUrl: mocks.getPresignedUrl,
    }));

    const mockBucketName = "mock-bucket";
    let mockRequest: APIGatewayProxyEvent;

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
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
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        await expect(handler()).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the GTFS-RT service alerts downloader endpoint",
        );
    });

    describe("downloading GTFS-RT", () => {
        it("returns a 302 with a GTFS-RT download link when the download query param is true", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs-rt-service-alerts.json?hello=world`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            mockRequest.queryStringParameters = {
                download: "true",
            };

            await expect(handler()).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
                body: "",
            });

            expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
                { Bucket: mockBucketName, Key: "gtfs-rt-service-alerts.bin" },
                3600,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when a download link cannot be generated", async () => {
            mocks.getPresignedUrl.mockRejectedValueOnce(new Error());

            mockRequest.queryStringParameters = {
                download: "true",
            };

            await expect(handler()).rejects.toThrow("An unexpected error occurred");

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the GTFS-RT service alerts downloader endpoint",
            );
        });
    });
});
