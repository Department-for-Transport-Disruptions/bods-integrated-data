import { mockInput } from "@bods-integrated-data/shared/avl/test/unsubscribeMockData";
import * as unsubscribe from "@bods-integrated-data/shared/avl/unsubscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayProxyEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("avl-unsubscriber", () => {
    let mockUnsubscribeEvent: APIGatewayProxyEvent;

    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        deleteParameters: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/unsubscribe", () => ({
        sendTerminateSubscriptionRequest: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const deleteParametersSpy = vi.spyOn(ssm, "deleteParameters");
    const sendTerminateSubscriptionRequestSpy = vi.spyOn(unsubscribe, "sendTerminateSubscriptionRequest");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.AVL_PRODUCER_API_KEY_ARN = "mock-key-arn";

        mockUnsubscribeEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
            pathParameters: {
                subscriptionId: "mock-subscription-id",
            },
        } as unknown as APIGatewayProxyEvent;

        getSecretMock.mockResolvedValue("mock-api-key");
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process an unsubscribe request if sendTerminateSubscriptionRequestAndUpdateDynamo is called successfully, including deleting auth creds from parameter store", async () => {
        const avlSubscription: AvlSubscription = {
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com",
            publisherId: "mock-publisher-id",
            description: "description",
            shortDescription: "shortDescription",
            status: "live",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
            apiKey: "mock-api-key",
        };
        getDynamoItemSpy.mockResolvedValue(avlSubscription);

        await handler(mockUnsubscribeEvent);

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            mockUnsubscribeEvent.pathParameters?.subscriptionId,
            { ...mockInput.subscription, requestorRef: null },
        );

        expect(deleteParametersSpy).toHaveBeenCalledOnce();
        expect(deleteParametersSpy).toHaveBeenCalledWith([
            "/subscription/mock-subscription-id/username",
            "/subscription/mock-subscription-id/password",
        ]);
    });

    it.each([
        [undefined, "subscriptionId is required"],
        ["", "subscriptionId must be 1-256 characters"],
        ["1".repeat(257), "subscriptionId must be 1-256 characters"],
    ])(
        "Throws an error when the subscription ID fails validation (test: %o)",
        async (subscriptionId, expectedErrorMessage) => {
            mockUnsubscribeEvent.pathParameters = {
                subscriptionId,
            };

            const response = await handler(mockUnsubscribeEvent);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: [expectedErrorMessage] }),
            });
            expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
            expect(putDynamoItemSpy).not.toHaveBeenCalled();
            expect(deleteParametersSpy).not.toHaveBeenCalled();
        },
    );

    it("should throw an error if subscription id not found in dynamo.", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });
        expect(logger.error).toHaveBeenCalledWith("Subscription not found", expect.any(Error));

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if a sendTerminateSubscriptionRequestAndUpdateDynamo was not successful", async () => {
        const avlSubscription: AvlSubscription = {
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com",
            publisherId: "mock-publisher-id",
            description: "description",
            shortDescription: "shortDescription",
            status: "live",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
            apiKey: "mock-api-key",
        };

        getDynamoItemSpy.mockResolvedValue(avlSubscription);

        sendTerminateSubscriptionRequestSpy.mockRejectedValue({ statusCode: 500 });

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            mockUnsubscribeEvent.pathParameters?.subscriptionId,
            { ...mockInput.subscription, requestorRef: null },
        );
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it.each([[undefined], ["invalid-key"]])("returns a 401 when an invalid api key is supplied", async (key) => {
        mockUnsubscribeEvent.headers = {
            "x-api-key": key,
        };

        const response = await handler(mockUnsubscribeEvent);
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

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
    });
});
