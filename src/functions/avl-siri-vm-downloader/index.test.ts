import { logger } from "@baselime/lambda-logger";
import * as utilFunctions from "@bods-integrated-data/shared/avl/utils";
import { GENERATED_SIRI_VM_FILE_PATH, GENERATED_SIRI_VM_TFL_FILE_PATH } from "@bods-integrated-data/shared/avl/utils";
import { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("avl-siri-vm-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            getPresignedUrl: vi.fn(),
            execute: vi.fn(),
            destroy: vi.fn(),
            mockDbClient: {
                destroy: vi.fn(),
            },
            createResponseStream: vi.fn((_responseStream, response) => response),
            streamifyResponse: vi.fn((handler) => handler),
        };
    });

    vi.mock("./utils", async () => ({
        createResponseStream: mocks.createResponseStream,
        streamifyResponse: mocks.streamifyResponse,
    }));

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getPresignedUrl: mocks.getPresignedUrl,
    }));

    vi.mock("@bods-integrated-data/shared/database", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/database")>()),
        getDatabaseClient: vi.fn().mockReturnValue(mocks.mockDbClient),
    }));

    const getAvlDataForSiriVmMock = vi.spyOn(utilFunctions, "getAvlDataForSiriVm");
    const createSiriVmMock = vi.spyOn(utilFunctions, "createSiriVm");

    const mockBucketName = "mock-bucket";
    let mockRequest: APIGatewayProxyEventV2;

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            error: vi.fn(),
        },
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
        mockRequest = {} as APIGatewayProxyEventV2;
    });

    afterEach(() => {
        vi.clearAllMocks();
        getAvlDataForSiriVmMock.mockReset();
        createSiriVmMock.mockReset();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
            statusCode: 500,
            body: "An internal error occurred.",
        });

        expect(logger.error).toHaveBeenCalledWith("Missing env vars - BUCKET_NAME must be set");
    });

    describe("fetching SIRI-VM in-place", () => {
        it("returns a 200 with SIRI-VM in-place", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/${GENERATED_SIRI_VM_FILE_PATH}`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
            });

            expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
                {
                    Bucket: mockBucketName,
                    Key: GENERATED_SIRI_VM_FILE_PATH,
                    ResponseContentDisposition: "inline",
                    ResponseContentType: "application/xml",
                },
                3600,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with SIRI-VM TfL in-place when the downloadTfl param is true", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/${GENERATED_SIRI_VM_TFL_FILE_PATH}`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            mockRequest.queryStringParameters = {
                downloadTfl: "true",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
            });

            expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
                {
                    Bucket: mockBucketName,
                    Key: GENERATED_SIRI_VM_TFL_FILE_PATH,
                    ResponseContentDisposition: "inline",
                    ResponseContentType: "application/xml",
                },
                3600,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when an unexpected error occurs", async () => {
            mocks.getPresignedUrl.mockRejectedValueOnce(new Error());

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            });
        });
    });

    describe("filter SIRI-VM", () => {
        it("returns a 200 with filtered data when the boundingBox query param is 4 numbers", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                boundingBox: "1,2,3,4",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                "1,2,3,4",
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the boundingBox query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                boundingBox: "asdf",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "boundingBox"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 400 when the boundingBox query param has less than 4 items", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                boundingBox: "1,2,3",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: "Bounding box must contain 4 items; minLongitude, minLatitude, maxLongitude and maxLatitude",
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the operatorRef query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                operatorRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                "1",
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the operatorRef query param is an array of strings", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                operatorRef: "1,2,3",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                "1,2,3",
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the operatorRef query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                operatorRef: "asdf123!@£",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "operatorRef"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the vehicleRef query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                vehicleRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                "1",
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the vehicleRef query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                vehicleRef: "asdf123!@£",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "vehicleRef"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the lineRef query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                lineRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                "1",
                undefined,
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the lineRef query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                lineRef: "asdf123!@£",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "lineRef"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the producerRef query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                producerRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                undefined,
                "1",
                undefined,
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the producerRef query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                producerRef: "asdf123!@£",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "producerRef"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the originRef query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                originRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                "1",
                undefined,
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the originRef query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                originRef: "asdf123!@£",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "originRef"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the destinationRef query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                destinationRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                "1",
                undefined,
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 400 when the destinationRef query param is an unexpected format", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);

            mockRequest.queryStringParameters = {
                destinationRef: "asdf123!@£",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 400,
                body: 'Validation error: Invalid at "destinationRef"',
            });

            expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
        });

        it("returns a 200 with filtered data when the subscriptionId query param is a string", async () => {
            getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
            createSiriVmMock.mockReturnValueOnce("siri-output");

            mockRequest.queryStringParameters = {
                subscriptionId: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: "siri-output",
            });

            expect(getAvlDataForSiriVmMock).toHaveBeenCalledWith(
                mocks.mockDbClient,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                "1",
            );
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when an unexpected error occurs", async () => {
            getAvlDataForSiriVmMock.mockRejectedValueOnce(new Error("Database fetch error"));

            mockRequest.queryStringParameters = {
                operatorRef: "1",
            };

            await expect(handler(mockRequest, {} as Context, () => undefined)).resolves.toEqual({
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            });

            expect(logger.error).toHaveBeenCalledWith(
                "There was an error retrieving the SIRI-VM data",
                expect.any(Error),
            );
        });
    });
});
