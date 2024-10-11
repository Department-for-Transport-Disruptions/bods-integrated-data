import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import * as s3 from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mockBucketName = "mock-bucket";
    const getPresignedUrlMock = vi.spyOn(s3, "getPresignedUrl");

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
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        const mockEvent = {
            queryStringParameters: {},
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the GTFS downloader endpoint",
        );
    });

    it("returns a 500 when a presigned URL could not be generated", async () => {
        getPresignedUrlMock.mockRejectedValueOnce(new Error());

        const mockEvent = {
            queryStringParameters: {},
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the GTFS downloader endpoint",
        );
    });

    it("returns a 302 with a presigned URL when the URL is successfully generated", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        const mockEvent = {
            queryStringParameters: {},
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 302,
            headers: {
                Location: mockPresignedUrl,
            },
            body: "",
        });

        expect(logger.error).not.toHaveBeenCalled();
    });

    it("retrieves national dataset if no region passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        const mockEvent = {
            queryStringParameters: {},
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await handler(mockEvent, mockContext, mockCallback);

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

        const mockEvent = {
            queryStringParameters: {
                regionCode: "EA",
            },
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await handler(mockEvent, mockContext, mockCallback);

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

        const mockEvent = {
            queryStringParameters: {
                regionCode: "INVALID",
            },
            body: "",
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid region code"] }),
        });
    });

    it("retrieves regional dataset if region name passed", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        const mockEvent = {
            queryStringParameters: {
                regionName: "east_anglia",
            },
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await handler(mockEvent, mockContext, mockCallback);

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

        const mockEvent = {
            queryStringParameters: {
                regionName: "INVALID",
            },
            body: "",
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid region name"] }),
        });
    });
});
