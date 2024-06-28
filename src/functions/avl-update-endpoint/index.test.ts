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

    it("should throw a 404 status code if given subscription ID does not exist in dynamo", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        await expect(handler(mockUpdateEvent)).resolves.toEqual({
            statusCode: 404,
            body: "Subscription with ID: mock-subscription-id not found in subscription table.",
        });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });

    it.each([
        [
            {
                test: "invalid event",
            },
        ],
        [
            {
                dataProducerEndpoint: "test-invalid-endpoint",
                description: "updated description",
                shortDescription: "updated short description",
                username: "updatedUsername",
                password: "updatedPassword",
            },
        ],
    ])("should throw a 500 status code if body does not match expected schema", async (input) => {
        const invalidEvent = { ...mockUpdateEvent, body: JSON.stringify(input) } as unknown as APIGatewayProxyEvent;

        await expect(handler(invalidEvent)).resolves.toEqual({
            body: "An unknown error occurred. Please try again.",
            statusCode: 500,
        });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error is env vars are missing", async () => {
        process.env.TABLE_NAME = "";
        process.env.DATA_ENDPOINT = "";

        await expect(handler(mockUpdateEvent)).resolves.toEqual({
            body: "An unknown error occurred. Please try again.",
            statusCode: 500,
        });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });
});
