import * as subscribe from "@bods-integrated-data/shared/avl/subscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { APIGatewayEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import { mockAvlSubscribeMessage, mockAvlSubscriptionDetails, mockSubscribeEvent } from "./test/mockData";

describe("avl-subscriber", () => {
    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.DATA_ENDPOINT = "https://www.test.com/data";
    });

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/subscribe", () => ({
        sendSubscriptionRequestAndUpdateDynamo: vi.fn(),
        addSubscriptionAuthCredsToSsm: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const sendSubscriptionRequestAndUpdateDynamoSpy = vi.spyOn(subscribe, "sendSubscriptionRequestAndUpdateDynamo");
    const addSubscriptionAuthCredsToSsmSpy = vi.spyOn(subscribe, "addSubscriptionAuthCredsToSsm");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
        getDynamoItemSpy.mockResolvedValue(null);
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        await handler(mockSubscribeEvent);

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
            undefined,
        );
    });

    it.each([
        [
            {
                test: "invalid event",
            },
        ],
        [
            {
                dataProducerEndpoint: "test-dataProducerEndpoint",
                description: "test-description",
                shortDescription: "test-shortDescription",
                username: "test-username",
                password: "test-password",
                requestorRef: "test-requestorRef",
            },
        ],
    ])(
        "should throw an error if the event body from the API gateway event does not match the avlSubscribeMessage schema.",
        async (input) => {
            const invalidEvent = { body: JSON.stringify(input) } as unknown as APIGatewayEvent;

            await expect(handler(invalidEvent)).rejects.toThrowError("Invalid subscribe message from event body.");

            expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
            expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
        },
    );

    it("should throw an error if an sendSubscriptionRequestAndUpdateDynamo was not successful", async () => {
        sendSubscriptionRequestAndUpdateDynamoSpy.mockRejectedValue({ statusCode: 500 });

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError();

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
            undefined,
        );
    });

    it("returns a 409 when attempting to subscribe with a subscription ID that is already active", async () => {
        getDynamoItemSpy.mockResolvedValue({
            status: "LIVE",
        });

        await expect(handler(mockSubscribeEvent)).resolves.toEqual({
            statusCode: 409,
            body: "Subscription ID already active",
        });

        expect(addSubscriptionAuthCredsToSsmSpy).not.toHaveBeenCalledOnce();
        expect(sendSubscriptionRequestAndUpdateDynamoSpy).not.toHaveBeenCalledOnce();
    });

    getDynamoItemSpy.mockResolvedValue({
        PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
        url: "https://mock-data-producer.com/",
        description: "test-description",
        shortDescription: "test-short-description",
        lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
        status: "LIVE",
        requestorRef: null,
    });
});
