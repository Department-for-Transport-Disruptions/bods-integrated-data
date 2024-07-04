import * as subscribe from "@bods-integrated-data/shared/avl/subscribe";
import * as unsubscribe from "@bods-integrated-data/shared/avl/unsubscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { APIGatewayProxyEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

const mockUpdateEventBody = {
    dataProducerEndpoint: "https://www.updated-endpoint.com",
    description: "updated description",
    shortDescription: "updated short description",
    username: "updatedUsername",
    password: "updatedPassword",
};

const mockUpdateEvent = {
    pathParameters: {
        subscriptionId: "mock-subscription-id",
    },
    body: JSON.stringify(mockUpdateEventBody),
} as unknown as APIGatewayProxyEvent;

const expectedSubscriptionDetails = {
    description: "updated description",
    lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
    publisherId: "mock-publisher-id",
    requestorRef: null,
    serviceStartDatetime: "2024-01-01T15:20:02.093Z",
    shortDescription: "updated short description",
    url: "https://www.updated-endpoint.com",
};

describe("avl-update-endpoint", () => {
    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/unsubscribe", () => ({
        sendTerminateSubscriptionRequestAndUpdateDynamo: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/subscribe", () => ({
        sendSubscriptionRequestAndUpdateDynamo: vi.fn(),
        addSubscriptionAuthCredsToSsm: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const sendTerminateSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(
        unsubscribe,
        "sendTerminateSubscriptionRequestAndUpdateDynamo",
    );
    const sendSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(subscribe, "sendSubscriptionRequestAndUpdateDynamo");
    const addSubscriptionAuthCredsToSsmSpy = vi.spyOn(subscribe, "addSubscriptionAuthCredsToSsm");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.DATA_ENDPOINT = "https://www.test.com/data";
        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com",
            publisherId: "mock-publisher-id",
            description: "description",
            shortDescription: "shortDescription",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
        });
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should unsubscribe from data producer and resubscribe with new details", async () => {
        await expect(handler(mockUpdateEvent)).resolves.toStrictEqual({ statusCode: 204, body: "" });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockUpdateEvent.pathParameters?.subscriptionId,
            expectedSubscriptionDetails,
            "test-dynamo-table",
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
        sendTerminateSubscriptionRequestAndUpdateDynamoSpy.mockRejectedValue({ statusCode: 500 });

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

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
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
            const invalidEvent = { ...mockUpdateEvent, body: JSON.stringify(input) } as unknown as APIGatewayProxyEvent;

            await expect(handler(invalidEvent)).resolves.toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: expectedErrorMessages }),
            });

            expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
            expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
            expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        },
    );

    it("should return a 500 if env vars are missing", async () => {
        process.env.TABLE_NAME = "";
        process.env.DATA_ENDPOINT = "";

        await expect(handler(mockUpdateEvent)).resolves.toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });
});
