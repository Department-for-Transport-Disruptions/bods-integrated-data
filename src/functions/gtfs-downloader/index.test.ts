import { logger } from "@baselime/lambda-logger";
import * as s3 from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mockBucketName = "mock-bucket";
    const getPresignedUrlMock = vi.spyOn(s3, "getPresignedUrl");

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            error: vi.fn(),
        },
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An internal error occurred.",
        });

        expect(logger.error).toHaveBeenCalledWith("Missing env vars - BUCKET_NAME must be set");
    });

    it("returns a 500 when a presigned URL could not be generated", async () => {
        getPresignedUrlMock.mockRejectedValueOnce(new Error());

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        });

        expect(logger.error).toHaveBeenCalledWith(
            "There was an error generating a presigned URL for GTFS download",
            expect.any(Error),
        );
    });

    it("returns a 302 with a presigned URL when the URL is successfully generated", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        await expect(handler()).resolves.toEqual({
            statusCode: 302,
            headers: {
                Location: mockPresignedUrl,
            },
        });

        expect(logger.error).not.toHaveBeenCalled();
    });

    it("retrieves national dataset if no region passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        await handler();

        expect(getPresignedUrlMock).toBeCalledWith(
            {
                Bucket: mockBucketName,
                Key: "all_gtfs.zip",
            },
            3600,
        );
    });

    it("retrieves regional dataset if region code passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        await handler({ queryStringParameters: { regionCode: "EA" } } as unknown as APIGatewayProxyEventV2);

        expect(getPresignedUrlMock).toBeCalledWith(
            {
                Bucket: mockBucketName,
                Key: "ea_gtfs.zip",
            },
            3600,
        );
    });

    it("returns 400 if invalid region code passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        const response = await handler({
            queryStringParameters: { regionCode: "INVALID" },
        } as unknown as APIGatewayProxyEventV2);

        expect(response).toEqual({
            body: "Invalid region code",
            statusCode: 400,
        });
    });

    it("retrieves regional dataset if region name passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        await handler({ queryStringParameters: { regionName: "east_anglia" } } as unknown as APIGatewayProxyEventV2);

        expect(getPresignedUrlMock).toBeCalledWith(
            {
                Bucket: mockBucketName,
                Key: "ea_gtfs.zip",
            },
            3600,
        );
    });

    it("returns 400 if invalid region code passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        const response = await handler({
            queryStringParameters: { regionName: "INVALID" },
        } as unknown as APIGatewayProxyEventV2);

        expect(response).toEqual({
            body: "Invalid region name",
            statusCode: 400,
        });
    });
});
