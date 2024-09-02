import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { APIGatewayProxyEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAvlSubscription, handler, mapApiAvlSubscriptionResponse } from "./index";

describe("avl-subscriptions", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
        putDynamoItem: vi.fn(),
        recursiveScan: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.AVL_PRODUCER_API_KEY_ARN = "mock-key-arn";
        mockEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
        } as unknown as APIGatewayProxyEvent;
        getSecretMock.mockResolvedValue("mock-api-key");
    });

    it.each([[undefined], ["invalid-key"]])("returns a 401 when an invalid api key is supplied", async (key) => {
        mockEvent.headers = {
            "x-api-key": key,
        };

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 401,
            body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
    });

    it.each([
        [{ TABLE_NAME: "", AVL_PRODUCER_API_KEY_ARN: "mock-key-arn" }],
        [{ TABLE_NAME: "test-dynamo-table", AVL_PRODUCER_API_KEY_ARN: "" }],
    ])("throws an error when the required env vars are missing", async (env) => {
        process.env = env;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(getDynamoItemSpy).not.toHaveBeenCalled();
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    it("should return a 500 when an unexpected error occurs retrieving subscriptions data", async () => {
        recursiveScanSpy.mockRejectedValueOnce(new Error());

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the AVL subscriptions endpoint",
            expect.any(Error),
        );
    });

    it.each([["1".repeat(257), "subscriptionId must be 1-256 characters"]])(
        "should return a 400 when the subscription ID fails validation (test: %o)",
        async (subscriptionId, expectedErrorMessage) => {
            mockEvent.pathParameters = {
                subscriptionId,
            };

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: [expectedErrorMessage] }),
            });
            expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
            expect(getDynamoItemSpy).not.toHaveBeenCalled();
            expect(recursiveScanSpy).not.toHaveBeenCalled();
        },
    );

    it("should return a 404 when getting a subscription but the subscription does not exist in dynamodb", async () => {
        getDynamoItemSpy.mockResolvedValueOnce(null);

        mockEvent.pathParameters = {
            subscriptionId: "subscription-one",
        };

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });
        expect(logger.error).toHaveBeenCalledWith("Subscription not found", expect.any(Error));
        expect(dynamo.putDynamoItem).not.toBeCalled();
    });

    it.each([[null], [{}], [{ subscriptionId: "" }]])(
        "should return a 200 with all subscriptions data when passing no subscription ID param (test: %o)",
        async (input) => {
            const avlSubscriptions: AvlSubscription[] = [
                {
                    PK: "subscription-one",
                    url: "https://www.mock-data-producer-one.com",
                    description: "test-description",
                    shortDescription: "test-short-description",
                    status: "live",
                    requestorRef: "BODS_MOCK_PRODUCER",
                    lastAvlDataReceivedDateTime: "2024-01-01T15:20:02.093Z",
                    serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                    publisherId: "publisher-one",
                    apiKey: "api-key-one",
                },
                {
                    PK: "subscription-two",
                    url: "https://www.mock-data-producer-two.com",
                    description: "test-description",
                    shortDescription: "test-short-description",
                    status: "inactive",
                    requestorRef: "BODS_MOCK_PRODUCER",
                    serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                    publisherId: "publisher-one",
                    apiKey: "api-key-two",
                },
            ];

            recursiveScanSpy.mockResolvedValueOnce(avlSubscriptions);

            const expectedResponse: ApiAvlSubscription[] = [
                {
                    id: "subscription-one",
                    publisherId: "publisher-one",
                    status: "live",
                    lastAvlDataReceivedDateTime: "2024-01-01T15:20:02.093Z",
                    heartbeatLastReceivedDateTime: null,
                    serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                    serviceEndDatetime: null,
                    apiKey: "api-key-one",
                },
                {
                    id: "subscription-two",
                    publisherId: "publisher-one",
                    status: "inactive",
                    lastAvlDataReceivedDateTime: null,
                    heartbeatLastReceivedDateTime: null,
                    serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                    serviceEndDatetime: null,
                    apiKey: "api-key-two",
                },
            ];

            mockEvent.pathParameters = input;

            await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
                statusCode: 200,
                body: JSON.stringify(expectedResponse),
            });
            expect(getDynamoItemSpy).not.toHaveBeenCalled();
            expect(recursiveScanSpy).toHaveBeenCalled();
        },
    );

    it("should return a 200 with a single subscription when passing a subscription ID param", async () => {
        mockEvent.pathParameters = {
            subscriptionId: "subscription-one",
        };
        const avlSubscription: AvlSubscription = {
            PK: "subscription-one",
            url: "https://www.mock-data-producer-one.com",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "live",
            requestorRef: "BODS_MOCK_PRODUCER",
            lastAvlDataReceivedDateTime: "2024-01-01T15:20:02.093Z",
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "publisher-one",
            apiKey: "api-key-one",
        };

        getDynamoItemSpy.mockResolvedValueOnce(avlSubscription);

        const expectedResponse: ApiAvlSubscription = {
            id: "subscription-one",
            publisherId: "publisher-one",
            status: "live",
            lastAvlDataReceivedDateTime: "2024-01-01T15:20:02.093Z",
            heartbeatLastReceivedDateTime: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            serviceEndDatetime: null,
            apiKey: "api-key-one",
        };

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify(expectedResponse),
        });
        expect(getDynamoItemSpy).toHaveBeenCalled();
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    describe("mapApiAvlSubscriptionResponse", () => {
        it("maps AVL table data to API response data", () => {
            const subscription: AvlSubscription = {
                PK: "mock-PK",
                url: "mock-url",
                description: "mock-description",
                shortDescription: "mock-shortDescription",
                status: "live",
                requestorRef: "mock-requestorRef",
                heartbeatLastReceivedDateTime: "mock-heartbeatLastReceivedDateTime",
                serviceStartDatetime: "mock-serviceStartDatetime",
                serviceEndDatetime: "mock-serviceEndDatetime",
                publisherId: "mock-publisherId",
                lastAvlDataReceivedDateTime: "mock-lastAvlDataReceivedDateTime",
                apiKey: "mock-api-key",
            };

            const expectedApiResponse: ApiAvlSubscription = {
                id: "mock-PK",
                publisherId: "mock-publisherId",
                status: "live",
                lastAvlDataReceivedDateTime: "mock-lastAvlDataReceivedDateTime",
                heartbeatLastReceivedDateTime: "mock-heartbeatLastReceivedDateTime",
                serviceStartDatetime: "mock-serviceStartDatetime",
                serviceEndDatetime: "mock-serviceEndDatetime",
                apiKey: "mock-api-key",
            };

            expect(mapApiAvlSubscriptionResponse(subscription)).toEqual(expectedApiResponse);
        });

        it("maps AVL table data to API response data with null values for missing properties", () => {
            const subscription: AvlSubscription = {
                PK: "mock-PK",
                publisherId: "publisher-one",
                url: "mock-url",
                description: "mock-description",
                shortDescription: "mock-shortDescription",
                status: "live",
                apiKey: "mock-api-key",
            };

            const expectedApiResponse: ApiAvlSubscription = {
                id: "mock-PK",
                status: "live",
                publisherId: "publisher-one",
                lastAvlDataReceivedDateTime: null,
                heartbeatLastReceivedDateTime: null,
                serviceStartDatetime: null,
                serviceEndDatetime: null,
                apiKey: "mock-api-key",
            };

            expect(mapApiAvlSubscriptionResponse(subscription)).toEqual(expectedApiResponse);
        });
    });
});
