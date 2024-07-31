import * as subscribe from "@bods-integrated-data/shared/avl/subscribe";
import * as unsubscribe from "@bods-integrated-data/shared/avl/unsubscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { AvlSubscription, AvlUpdateBody } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { APIGatewayProxyEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("avl-update-endpoint", () => {
    const mockUpdateEventBody: AvlUpdateBody = {
        dataProducerEndpoint: "https://www.updated-endpoint.com",
        description: "updated description",
        shortDescription: "updated short description",
        username: "updatedUsername",
        password: "updatedPassword",
    };

    let mockUpdateEvent: APIGatewayProxyEvent;

    const expectedSubscriptionDetails: Omit<AvlSubscription, "PK" | "status"> = {
        description: "updated description",
        lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
        publisherId: "mock-publisher-id",
        requestorRef: null,
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        shortDescription: "updated short description",
        url: "https://www.updated-endpoint.com",
        apiKey: "5965q7gh-5428-43e2-a75c-1782a48637d5",
    };

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/unsubscribe", () => ({
        sendTerminateSubscriptionRequest: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/subscribe", () => ({
        sendSubscriptionRequestAndUpdateDynamo: vi.fn(),
        addSubscriptionAuthCredsToSsm: vi.fn(),
    }));

    vi.mock("node:crypto", () => ({
        randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const sendTerminateSubscriptionRequestSpy = vi.spyOn(unsubscribe, "sendTerminateSubscriptionRequest");
    const sendSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(subscribe, "sendSubscriptionRequestAndUpdateDynamo");
    const addSubscriptionAuthCredsToSsmSpy = vi.spyOn(subscribe, "addSubscriptionAuthCredsToSsm");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.DATA_ENDPOINT = "https://www.test.com/data";
        process.env.AVL_PRODUCER_API_KEY_ARN = "mock-key-arn";

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
            apiKey: "5965q7gh-5428-43e2-a75c-1782a48637d5",
        };

        getDynamoItemSpy.mockResolvedValue(avlSubscription);

        mockUpdateEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
            pathParameters: {
                subscriptionId: "mock-subscription-id",
            },
            body: JSON.stringify(mockUpdateEventBody),
        } as unknown as APIGatewayProxyEvent;

        getSecretMock.mockResolvedValue("mock-api-key");
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should unsubscribe from data producer and resubscribe with new details", async () => {
        await expect(handler(mockUpdateEvent)).resolves.toStrictEqual({ statusCode: 204, body: "" });

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            mockUpdateEvent.pathParameters?.subscriptionId,
            expectedSubscriptionDetails,
        );
        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledWith(
            mockUpdateEvent.pathParameters?.subscriptionId,
            mockUpdateEventBody.username,
            mockUpdateEventBody.password,
        );
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockUpdateEvent.pathParameters?.subscriptionId,
            expectedSubscriptionDetails,
            mockUpdateEventBody.username,
            mockUpdateEventBody.password,
            "test-dynamo-table",
            process.env.DATA_ENDPOINT,
            undefined,
        );
    });

    it("should resubscribe with new details from data producer even if unsubscribe step is unsuccessful", async () => {
        sendTerminateSubscriptionRequestSpy.mockRejectedValue({ statusCode: 500 });

        await expect(handler(mockUpdateEvent)).resolves.toStrictEqual({ statusCode: 204, body: "" });

        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).toHaveBeenCalledWith(
            mockUpdateEvent.pathParameters?.subscriptionId,
            mockUpdateEventBody.username,
            mockUpdateEventBody.password,
        );
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockUpdateEvent.pathParameters?.subscriptionId,
            expectedSubscriptionDetails,
            mockUpdateEventBody.username,
            mockUpdateEventBody.password,
            "test-dynamo-table",
            process.env.DATA_ENDPOINT,
            undefined,
        );
    });

    it("should return a 404 if given subscription ID does not exist in dynamo", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        await expect(handler(mockUpdateEvent)).resolves.toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });

    it.each([
        [null, ["Body must be an object with required properties"]],
        ["", ["Body must be an object with required properties"]],
        [{}, ["dataProducerEndpoint is required", "username is required", "password is required"]],
        [
            {
                test: "invalid event",
            },
            ["dataProducerEndpoint is required", "username is required", "password is required"],
        ],
        [
            {
                dataProducerEndpoint: null,
                username: null,
                password: null,
            },
            ["dataProducerEndpoint must be a string", "username must be a string", "password must be a string"],
        ],
        [
            {
                dataProducerEndpoint: 1,
                description: 1,
                shortDescription: 1,
                username: 1,
                password: 1,
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: {},
                description: {},
                shortDescription: {},
                username: {},
                password: {},
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: "https://example.com",
                description: "",
                shortDescription: "",
                username: "",
                password: "",
            },
            [
                "description must be 1-256 characters",
                "shortDescription must be 1-256 characters",
                "username must be 1-256 characters",
                "password must be 1-256 characters",
            ],
        ],
        [
            {
                dataProducerEndpoint: "asdf",
                description: "1".repeat(257),
                shortDescription: "1".repeat(257),
                username: "1".repeat(257),
                password: "1".repeat(257),
            },
            [
                "dataProducerEndpoint must be a URL",
                "description must be 1-256 characters",
                "shortDescription must be 1-256 characters",
                "username must be 1-256 characters",
                "password must be 1-256 characters",
            ],
        ],
    ])(
        "should return a 400 if event body from the API gateway event does not match the avlUpdateBody schema (test: %o).",
        async (input, expectedErrorMessages) => {
            mockUpdateEvent.body = JSON.stringify(input);

            await expect(handler(mockUpdateEvent)).resolves.toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: expectedErrorMessages }),
            });

            expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
            expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
            expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        },
    );

    it.each([[undefined], ["invalid-key"]])("returns a 401 when an invalid api key is supplied", async (key) => {
        mockUpdateEvent.headers = {
            "x-api-key": key,
        };

        const response = await handler(mockUpdateEvent);
        expect(response).toEqual({
            statusCode: 401,
            body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
    });

    it.each([
        [{ TABLE_NAME: "", DATA_ENDPOINT: "https://www.test.com/data", AVL_PRODUCER_API_KEY_ARN: "mock-key-arn" }],
        [{ TABLE_NAME: "test-dynamo-table", DATA_ENDPOINT: "", AVL_PRODUCER_API_KEY_ARN: "mock-key-arn" }],
        [{ TABLE_NAME: "test-dynamo-table", DATA_ENDPOINT: "https://www.test.com/data", AVL_PRODUCER_API_KEY_ARN: "" }],
    ])("throws an error when the required env vars are missing", async (env) => {
        process.env = env;

        const response = await handler(mockUpdateEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });
});
