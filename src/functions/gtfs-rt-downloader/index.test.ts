import { logger } from "@baselime/lambda-logger";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

const getMockApiEvent = (passDownloadParam: boolean = true): APIGatewayProxyEventV2 => ({
    version: "",
    routeKey: "",
    rawPath: "",
    rawQueryString: "",
    isBase64Encoded: false,
    headers: {},
    requestContext: {
        accountId: "",
        apiId: "",
        domainName: "",
        domainPrefix: "",
        http: {
            method: "",
            path: "",
            protocol: "",
            sourceIp: "",
            userAgent: "",
        },
        requestId: "",
        routeKey: "",
        stage: "",
        time: "",
        timeEpoch: 0,
    },
    queryStringParameters: {
        download: passDownloadParam ? "true" : "false",
    },
});

describe("gtfs-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
            getPresignedUrl: vi.fn(),
        };
    });

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
        getPresignedUrl: mocks.getPresignedUrl,
    }));

    const mockBucketName = "mock-bucket";
    const mockApiEvent = getMockApiEvent();

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            error: vi.fn(),
        },
    }));

    describe("when download is true", () => {
        beforeEach(() => {
            process.env.BUCKET_NAME = mockBucketName;
        });

        afterEach(() => {
            vi.resetAllMocks();
        });

        it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
            process.env.BUCKET_NAME = "";

            await expect(handler(mockApiEvent)).resolves.toEqual({
                statusCode: 500,
                body: "An internal error occurred.",
            });

            expect(logger.error).toHaveBeenCalledWith("Missing env vars - BUCKET_NAME must be set");
        });

        it("returns a 500 when a presigned URL could not be generated", async () => {
            mocks.getPresignedUrl.mockRejectedValueOnce(new Error());

            await expect(handler(mockApiEvent)).resolves.toEqual({
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            });

            expect(logger.error).toHaveBeenCalledWith(
                "There was an error generating a presigned URL for GTFS-RT download",
                expect.any(Error),
            );
        });

        it("returns a 302 with a presigned URL when the URL is successfully generated", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs-rt.json?hello=world`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            await expect(handler(mockApiEvent)).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
            });

            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a presigned url to the file", async () => {
            await handler(mockApiEvent);
            expect(mocks.getPresignedUrl).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" }, 3600);
        });
    });

    describe("when download is not true", () => {
        const falseDownload = getMockApiEvent(false);

        it("returns a 200 with the data when the data is successfully retrieved", async () => {
            mocks.getS3Object.mockResolvedValue({ Body: { transformToString: () => Promise.resolve("test") } });
            await expect(handler(falseDownload)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/octet-stream" },
                body: "test",
                isBase64Encoded: true,
            });

            expect(logger.error).not.toHaveBeenCalled();
        });

        it("retrieves the content of the file when the download parameter is false", async () => {
            await handler(falseDownload);
            expect(mocks.getS3Object).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" });
        });

        it("retrieves the content of the file when the download parameter is not passed", async () => {
            delete falseDownload.queryStringParameters;
            await handler(falseDownload);
            expect(mocks.getS3Object).toHaveBeenCalledWith({ Bucket: mockBucketName, Key: "gtfs-rt.bin" });
        });

        it("returns a 500 when data is empty", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: undefined });
            await expect(handler(falseDownload)).resolves.toEqual({
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            });
        });
    });
});
