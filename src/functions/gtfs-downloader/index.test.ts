import { logger } from "@baselime/lambda-logger";
import * as s3 from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mockBucketName = "mock-bucket";
    const getPresignedUrlMock = vi.spyOn(s3, "getPresignedUrl");

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
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

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });

        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the GTFS downloader endpoint",
            expect.any(Error),
        );
    });

    it("returns a 500 when a presigned URL could not be generated", async () => {
        getPresignedUrlMock.mockRejectedValueOnce(new Error());

        const mockEvent = {
            queryStringParameters: {},
            body: "",
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });

        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the GTFS downloader endpoint",
            expect.any(Error),
        );
    });

    it("returns a 302 with a presigned URL when the URL is successfully generated", async () => {
        const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`;
        getPresignedUrlMock.mockResolvedValueOnce(mockPresignedUrl);

        const mockEvent = {
            queryStringParameters: {},
            body: "",
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(mockEvent)).resolves.toEqual({
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

        await handler(mockEvent);

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

        await handler(mockEvent);

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

        const response = await handler(mockEvent);
        // const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(400);
        // expect(responseBody).toEqual({ errors: ["Invalid region code"] });
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

        await handler(mockEvent);

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

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(400);
        expect(responseBody).toEqual({ errors: ["Invalid region name"] });
    });
});
