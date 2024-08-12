import * as utilFunctions from "@bods-integrated-data/shared/avl/utils";
import { GENERATED_SIRI_VM_FILE_PATH, GENERATED_SIRI_VM_TFL_FILE_PATH } from "@bods-integrated-data/shared/avl/utils";
import { logger } from "@bods-integrated-data/shared/logger";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { APIGatewayEvent } from "aws-lambda";
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

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    const getAvlDataForSiriVmMock = vi.spyOn(utilFunctions, "getAvlDataForSiriVm");
    const createSiriVmMock = vi.spyOn(utilFunctions, "createSiriVm");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    const mockBucketName = "mock-bucket";
    let mockRequest: APIGatewayEvent;

    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
        process.env.AVL_CONSUMER_API_KEY_ARN = "avl-consumer-api-key-arn";
        getSecretMock.mockResolvedValue("mock-api-key");
    });

    afterEach(() => {
        vi.clearAllMocks();
        getAvlDataForSiriVmMock.mockReset();
        createSiriVmMock.mockReset();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        const response = await handler(mockRequest);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the SIRI-VM downloader endpoint",
            expect.any(Error),
        );
    });

    it("returns a 500 when the AVL_CONSUMER_API_KEY_ARN environment variable is missing", async () => {
        process.env.AVL_CONSUMER_API_KEY_ARN = "";

        const response = await handler(mockRequest);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the SIRI-VM downloader endpoint",
            expect.any(Error),
        );
    });

    it.each([[undefined], ["invalid-key"]])("returns a 401 when an invalid api key is supplied", async () => {
        mockRequest.queryStringParameters = {
            operatorRef: "1",
        };

        const response = await handler(mockRequest);
        expect(response).toEqual({
            statusCode: 401,
            body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
    });

    describe("fetching SIRI-VM in-place", () => {
        it("returns a 200 with SIRI-VM in-place", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/${GENERATED_SIRI_VM_FILE_PATH}`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
                body: "",
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

            await expect(handler(mockRequest)).resolves.toEqual({
                statusCode: 302,
                headers: {
                    Location: mockPresignedUrl,
                },
                body: "",
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

            const response = await handler(mockRequest);
            expect(response).toEqual({
                statusCode: 500,
                body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
            });
        });
    });

    describe("filter SIRI-VM", () => {
        describe("valid requests", () => {
            // todo: combine these into an it.each
            it("returns a 200 with filtered data when the boundingBox query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    boundingBox: "1,2,3,4",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the operatorRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    operatorRef: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the operatorRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    operatorRef: "1,2,3",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the vehicleRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    vehicleRef: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the lineRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    lineRef: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the producerRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    producerRef: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the originRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    originRef: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the destinationRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    destinationRef: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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

            it("returns a 200 with filtered data when the subscriptionId query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mockRequest.queryStringParameters = {
                    subscriptionId: "1",
                };

                await expect(handler(mockRequest)).resolves.toEqual({
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
        });

        describe("invalid requests", () => {
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
                    { operatorRef: "asdf123!@£" },
                    "operatorRef must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
                [
                    { operatorRef: "3," },
                    "operatorRef must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
                [
                    { vehicleRef: "asdf123!@£" },
                    "vehicleRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
                [
                    { lineRef: "asdf123!@£" },
                    "lineRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
                [
                    { producerRef: "asdf123!@£" },
                    "producerRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
                [
                    { originRef: "asdf123!@£" },
                    "originRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
                [
                    { destinationRef: "asdf123!@£" },
                    "destinationRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
                ],
            ])("returns a 400 when the %o query param fails validation", async (params, expectedErrorMessage) => {
                mockRequest.queryStringParameters = params;
                const response = await handler(mockRequest);
                expect(response).toEqual({
                    statusCode: 400,
                    body: JSON.stringify({ errors: [expectedErrorMessage] }),
                });
                expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
                expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
            });

            it("returns a 500 when an unexpected error occurs", async () => {
                getAvlDataForSiriVmMock.mockRejectedValueOnce(new Error("Database fetch error"));

                mockRequest.queryStringParameters = {
                    operatorRef: "1",
                };

                const response = await handler(mockRequest);
                expect(response).toEqual({
                    statusCode: 500,
                    body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
                });

                expect(logger.error).toHaveBeenCalledWith(
                    "There was a problem with the SIRI-VM downloader endpoint",
                    expect.any(Error),
                );
            });
        });
    });
});
