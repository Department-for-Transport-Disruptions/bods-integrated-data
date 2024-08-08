import * as utilFunctions from "@bods-integrated-data/shared/avl/utils";
import { GENERATED_SIRI_VM_FILE_PATH, GENERATED_SIRI_VM_TFL_FILE_PATH } from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSiriVm } from "./siri-vm";

describe("avl-siri-vm-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            getPresignedUrl: vi.fn(),
            execute: vi.fn(),
            destroy: vi.fn(),
            mockDbClient: {
                destroy: vi.fn(),
            } as unknown as KyselyDb,
            fastify: {
                log: {
                    warn: vi.fn(),
                    error: vi.fn(),
                },
            } as unknown as FastifyInstance,
            request: {
                query: {},
            } as unknown as FastifyRequest,
            reply: {
                headers: vi.fn(),
                send: vi.fn(),
                redirect: vi.fn(),
                badRequest: vi.fn(),
                internalServerError: vi.fn(),
            } as unknown as FastifyReply,
            putMetricMock: vi.fn(),
        };
    });

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getPresignedUrl: mocks.getPresignedUrl,
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: mocks.putMetricMock,
    }));

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    const getAvlDataForSiriVmMock = vi.spyOn(utilFunctions, "getAvlDataForSiriVm");
    const createSiriVmMock = vi.spyOn(utilFunctions, "createSiriVm");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    const mockBucketName = "mock-bucket";

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

        await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);
        expect(mocks.reply.internalServerError).toHaveBeenCalledOnce();
        expect(mocks.fastify.log.error).toHaveBeenCalledWith(
            "There was a problem with the SIRI-VM downloader endpoint",
            expect.any(Error),
        );
    });

    describe("fetching SIRI-VM in-place", () => {
        it("returns a 200 with SIRI-VM in-place", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/${GENERATED_SIRI_VM_FILE_PATH}`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

            expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
                {
                    Bucket: mockBucketName,
                    Key: GENERATED_SIRI_VM_FILE_PATH,
                    ResponseContentDisposition: "inline",
                    ResponseContentType: "application/xml",
                },
                3600,
            );
            expect(mocks.reply.redirect).toBeCalledWith(mockPresignedUrl, 302);

            expect(mocks.fastify.log.error).not.toHaveBeenCalled();
        });

        it("returns a 200 with SIRI-VM TfL in-place when the downloadTfl param is true", async () => {
            const mockPresignedUrl = `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/${GENERATED_SIRI_VM_TFL_FILE_PATH}`;
            mocks.getPresignedUrl.mockResolvedValueOnce(mockPresignedUrl);

            mocks.request.query = {
                downloadTfl: "true",
            };

            await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

            expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
                {
                    Bucket: mockBucketName,
                    Key: GENERATED_SIRI_VM_TFL_FILE_PATH,
                    ResponseContentDisposition: "inline",
                    ResponseContentType: "application/xml",
                },
                3600,
            );
            expect(mocks.reply.redirect).toBeCalledWith(mockPresignedUrl, 302);

            expect(mocks.fastify.log.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when an unexpected error occurs", async () => {
            mocks.getPresignedUrl.mockRejectedValueOnce(new Error());

            await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

            expect(mocks.reply.internalServerError).toHaveBeenCalledOnce();
        });
    });

    describe("filter SIRI-VM", () => {
        describe("valid requests", () => {
            // todo: combine these into an it.each
            it("returns a 200 with filtered data when the boundingBox query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    boundingBox: "1,2,3,4",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the operatorRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    operatorRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the operatorRef query param is used with multiple refs", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    operatorRef: "1,2,3",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the vehicleRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    vehicleRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the lineRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    lineRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the producerRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    producerRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the originRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    originRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the destinationRef query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    destinationRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
            });

            it("returns a 200 with filtered data when the subscriptionId query param is used", async () => {
                getAvlDataForSiriVmMock.mockResolvedValueOnce([]);
                createSiriVmMock.mockReturnValueOnce("siri-output");

                mocks.request.query = {
                    subscriptionId: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.headers).toBeCalledWith({
                    "Content-Type": "application/xml",
                });
                expect(mocks.reply.send).toBeCalledWith("siri-output");

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
                expect(mocks.fastify.log.error).not.toHaveBeenCalled();
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
                mocks.request.query = params;

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.badRequest).toHaveBeenCalledWith(expectedErrorMessage);

                expect(mocks.fastify.log.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid request"));
                expect(getAvlDataForSiriVmMock).not.toHaveBeenCalled();
                expect(mocks.putMetricMock).toHaveBeenCalledWith("custom/SIRIVMDownloader", [
                    {
                        MetricName: "4xx",
                        Value: 1,
                    },
                ]);
            });

            it("returns a 500 when an unexpected error occurs", async () => {
                getAvlDataForSiriVmMock.mockRejectedValueOnce(new Error("Database fetch error"));

                mocks.request.query = {
                    operatorRef: "1",
                };

                await downloadSiriVm(mocks.fastify, mocks.mockDbClient, mocks.request, mocks.reply);

                expect(mocks.reply.internalServerError).toHaveBeenCalledWith("An unexpected error occurred");

                expect(mocks.fastify.log.error).toHaveBeenCalledWith(
                    "There was a problem with the SIRI-VM downloader endpoint",
                    expect.any(Error),
                );

                expect(mocks.putMetricMock).toHaveBeenCalledWith("custom/SIRIVMDownloader", [
                    {
                        MetricName: "5xx",
                        Value: 1,
                    },
                ]);
            });
        });
    });
});
