import { logger } from "@baselime/lambda-logger";
import { mockInput } from "@bods-integrated-data/shared/avl/test/unsubscribeMockData";
import * as unsubscribe from "@bods-integrated-data/shared/avl/unsubscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayProxyEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("avl-unsubscriber", () => {
    const mockUnsubscribeEvent = {
        pathParameters: {
            subscriptionId: "mock-subscription-id",
        },
    } as unknown as APIGatewayProxyEvent;

    vi.mock("@baselime/lambda-logger", () => ({
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

    vi.mock("@bods-integrated-data/shared/avl/unsubscribe", () => ({
        sendTerminateSubscriptionRequestAndUpdateDynamo: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const deleteParametersSpy = vi.spyOn(ssm, "deleteParameters");
    const sendTerminateSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(
        unsubscribe,
        "sendTerminateSubscriptionRequestAndUpdateDynamo",
    );

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
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
        expect(deleteParametersSpy).toHaveBeenCalledWith([
            "/subscription/mock-subscription-id/username",
            "/subscription/mock-subscription-id/password",
        ]);
    });

    it.each([
        [undefined, "subscriptionId is required"],
        [null, "subscriptionId must be a string"],
        [1, "subscriptionId must be a string"],
        [{}, "subscriptionId must be a string"],
        ["", "subscriptionId must be 1-256 characters"],
        ["1".repeat(257), "subscriptionId must be 1-256 characters"],
    ])(
        "Throws an error when the subscription ID fails validation (test: %o)",
        async (subscriptionId, expectedErrorMessage) => {
            const mockEvent = {
                pathParameters: {
                    subscriptionId,
                },
                body: null,
            } as unknown as APIGatewayProxyEvent;

            const response = await handler(mockEvent);
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

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestAndUpdateDynamoSpy).toHaveBeenCalledWith(
            mockUnsubscribeEvent.pathParameters?.subscriptionId,
            { ...mockInput.subscription, requestorRef: null },
            "test-dynamo-table",
        );
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("Throws an error when the required env vars are missing", async () => {
        process.env.TABLE_NAME = "";

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the AVL unsubscribe endpoint",
            expect.any(Error),
        );
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
        expect(deleteParametersSpy).not.toHaveBeenCalled();
    });
});
