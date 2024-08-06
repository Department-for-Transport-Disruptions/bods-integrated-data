import * as subscribe from "@bods-integrated-data/shared/avl/subscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlSubscribeMessage, AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { APIGatewayProxyEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("avl-subscriber", () => {
    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/subscribe", () => ({
        sendSubscriptionRequestAndUpdateDynamo: vi.fn(),
        addSubscriptionAuthCredsToSsm: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    vi.mock("node:crypto", () => ({
        randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const sendSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(subscribe, "sendSubscriptionRequestAndUpdateDynamo");
    const addSubscriptionAuthCredsToSsmSpy = vi.spyOn(subscribe, "addSubscriptionAuthCredsToSsm");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    MockDate.set("2024-03-11T15:20:02.093Z");

    const mockAvlSubscribeMessage: AvlSubscribeMessage = {
        dataProducerEndpoint: "https://mock-data-producer.com",
        description: "description",
        shortDescription: "shortDescription",
        username: "test-user",
        password: "dummy-password",
        subscriptionId: "mock-subscription-id",
        publisherId: "mock-publisher-id",
    };

    const mockAvlSubscriptionDetails: Omit<AvlSubscription, "PK" | "status"> = {
        url: mockAvlSubscribeMessage.dataProducerEndpoint,
        description: mockAvlSubscribeMessage.description,
        shortDescription: mockAvlSubscribeMessage.shortDescription,
        publisherId: mockAvlSubscribeMessage.publisherId,
        requestorRef: undefined,
        apiKey: "5965q7gh-5428-43e2-a75c-1782a48637d5",
    };

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        vi.resetAllMocks();
        getDynamoItemSpy.mockResolvedValue(null);
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.DATA_ENDPOINT = "https://www.test.com/data";
        process.env.AVL_PRODUCER_API_KEY_ARN = "mock-key-arn";
        process.env.STAGE = "";
        process.env.MOCK_PRODUCER_SUBSCRIBE_ENDPOINT = "";
        mockEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
            body: JSON.stringify(mockAvlSubscribeMessage),
        } as unknown as APIGatewayProxyEvent;
        getSecretMock.mockResolvedValue("mock-api-key");
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        await handler(mockEvent, mockContext, mockCallback);

        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledWith(
            mockAvlSubscribeMessage.subscriptionId,
            mockAvlSubscribeMessage.username,
            mockAvlSubscribeMessage.password,
        );
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockAvlSubscribeMessage.subscriptionId,
            mockAvlSubscriptionDetails,
            mockAvlSubscribeMessage.username,
            mockAvlSubscribeMessage.password,
            "test-dynamo-table",
            "https://www.test.com/data",
            false,
            "",
        );
    });

    it.each([
        [null, ["Body must be an object with required properties"]],
        ["", ["Body must be an object with required properties"]],
        [
            {},
            [
                "dataProducerEndpoint is required",
                "description is required",
                "shortDescription is required",
                "username is required",
                "password is required",
                "subscriptionId is required",
                "publisherId is required",
            ],
        ],
        [
            {
                test: "invalid event",
            },
            [
                "dataProducerEndpoint is required",
                "description is required",
                "shortDescription is required",
                "username is required",
                "password is required",
                "subscriptionId is required",
                "publisherId is required",
            ],
        ],
        [
            {
                dataProducerEndpoint: null,
                description: null,
                shortDescription: null,
                username: null,
                password: null,
                subscriptionId: null,
                publisherId: null,
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
                "subscriptionId must be a string",
                "publisherId must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: 1,
                description: 1,
                shortDescription: 1,
                username: 1,
                password: 1,
                requestorRef: 1,
                subscriptionId: 1,
                publisherId: 1,
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
                "requestorRef must be a string",
                "subscriptionId must be a string",
                "publisherId must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: {},
                description: {},
                shortDescription: {},
                username: {},
                password: {},
                requestorRef: {},
                subscriptionId: {},
                publisherId: {},
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
                "requestorRef must be a string",
                "subscriptionId must be a string",
                "publisherId must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: "https://example.com",
                description: "",
                shortDescription: "",
                username: "",
                password: "",
                requestorRef: "",
                subscriptionId: "",
                publisherId: "",
            },
            [
                "description must be 1-256 characters",
                "shortDescription must be 1-256 characters",
                "username must be 1-256 characters",
                "password must be 1-256 characters",
                "requestorRef must be 1-256 characters",
                "subscriptionId must be 1-256 characters",
                "publisherId must be 1-256 characters",
            ],
        ],
        [
            {
                dataProducerEndpoint: "asdf",
                description: "1".repeat(257),
                shortDescription: "1".repeat(257),
                username: "1".repeat(257),
                password: "1".repeat(257),
                requestorRef: "1".repeat(257),
                subscriptionId: "1".repeat(257),
                publisherId: "1".repeat(257),
            },
            [
                "dataProducerEndpoint must be a URL",
                "description must be 1-256 characters",
                "shortDescription must be 1-256 characters",
                "username must be 1-256 characters",
                "password must be 1-256 characters",
                "requestorRef must be 1-256 characters",
                "subscriptionId must be 1-256 characters",
                "publisherId must be 1-256 characters",
            ],
        ],
    ])(
        "should throw an error if the event body from the API gateway event does not match the avlSubscribeMessage schema.",
        async (input, expectedErrorMessages) => {
            mockEvent.body = JSON.stringify(input);

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: expectedErrorMessages }),
            });

            expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
            expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        },
    );

    it("should throw an error if a sendSubscriptionRequestAndUpdateDynamo was not successful", async () => {
        sendSubscriptionRequestAndUpdateDynamoSpy.mockRejectedValue({ statusCode: 500 });

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledWith(
            mockAvlSubscribeMessage.subscriptionId,
            mockAvlSubscribeMessage.username,
            mockAvlSubscribeMessage.password,
        );
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockAvlSubscribeMessage.subscriptionId,
            mockAvlSubscriptionDetails,
            mockAvlSubscribeMessage.username,
            mockAvlSubscribeMessage.password,
            "test-dynamo-table",
            "https://www.test.com/data",
            false,
            "",
        );
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

    it("returns a 409 when attempting to subscribe with a subscription ID that is already active", async () => {
        getDynamoItemSpy.mockResolvedValue({
            status: "live",
        });

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 409,
            body: JSON.stringify({ errors: ["Subscription ID already active"] }),
        });

        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });

    it.each([
        [{ TABLE_NAME: "", DATA_ENDPOINT: "https://www.test.com/data", AVL_PRODUCER_API_KEY_ARN: "mock-key-arn" }],
        [{ TABLE_NAME: "test-dynamo-table", DATA_ENDPOINT: "", AVL_PRODUCER_API_KEY_ARN: "mock-key-arn" }],
        [{ TABLE_NAME: "test-dynamo-table", DATA_ENDPOINT: "https://www.test.com/data", AVL_PRODUCER_API_KEY_ARN: "" }],
    ])("throws an error when the required env vars are missing", async (env) => {
        process.env = env;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
    });

    it("throws an error when the stage is local and the mock data producer env var is missing", async () => {
        process.env.STAGE = "local";

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
    });
});
