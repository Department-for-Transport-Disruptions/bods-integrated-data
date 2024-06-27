import { mockInput } from "@bods-integrated-data/shared/avl/test/unsubscribeMockData";
import * as unsubscribe from "@bods-integrated-data/shared/avl/unsubscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("avl-unsubscriber", () => {
    const mockUnsubscribeEvent = {
        pathParameters: {
            subscriptionId: "mock-subscription-id",
        },
    } as unknown as APIGatewayEvent;

    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
    });

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        deleteParameters: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/unsubscribe", () => ({
        sendTerminateSubscriptionRequestAndUpdateDynamo: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const deleteParametersSpy = vi.spyOn(ssm, "deleteParameters");
    const sendTerminateSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(
        unsubscribe,
        "sendTerminateSubscriptionRequestAndUpdateDynamo",
    );

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process an unsubscribe request if sendTerminateSubscriptionRequestAndUpdateDynamo is called successfully, including deleting auth creds from parameter store", async () => {
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

        await handler(mockUnsubscribeEvent);

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockUnsubscribeEvent.pathParameters?.subscriptionId,
            { ...mockInput.subscription, requestorRef: null },
            "test-dynamo-table",
        );

        expect(deleteParametersSpy).toHaveBeenCalledOnce();
        expect(deleteParametersSpy).toBeCalledWith([
            "/subscription/mock-subscription-id/username",
            "/subscription/mock-subscription-id/password",
        ]);
    });

    it("should throw an error if subscription id not found in dynamo.", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        await expect(handler(mockUnsubscribeEvent)).resolves.toStrictEqual({
            statusCode: 404,
            body: "Subscription ID: mock-subscription-id not found in DynamoDB",
        });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if a sendTerminateSubscriptionRequestAndUpdateDynamo was not successful", async () => {
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

        sendTerminateSubscriptionRequestAndUpdateDynamoSpy.mockRejectedValue({ statusCode: 500 });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError();

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockUnsubscribeEvent.pathParameters?.subscriptionId,
            { ...mockInput.subscription, requestorRef: null },
            "test-dynamo-table",
        );
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });
});
