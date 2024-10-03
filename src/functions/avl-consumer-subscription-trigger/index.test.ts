import { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import {
    AvlSubscriptionDataSenderMessage,
    AvlSubscriptionTriggerMessage,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import * as sqs from "@bods-integrated-data/shared/sqs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("avl-consumer-subscription-trigger", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    const sendBatchMessageSpy = vi.spyOn(sqs, "sendBatchMessage");

    let mockEvent: Parameters<typeof handler>[0];

    beforeEach(() => {
        mockEvent = {
            subscriptionPK: "123",
            SK: "1234",
            queueUrl: "https://mock-queue-url",
            frequencyInSeconds: 20,
        } as AvlSubscriptionTriggerMessage as unknown as Parameters<typeof handler>[0];
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it.each([
        {},
        { SK: "1234", queueUrl: "https://mock-queue-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", queueUrl: "https://mock-queue-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", SK: "1234", frequencyInSeconds: 30 },
        { subcriptionPK: "123", SK: "1234", queueUrl: "https://mock-queue-url" },
        { subcriptionPK: "", SK: "1234", queueUrl: "https://mock-queue-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", SK: "", queueUrl: "https://mock-queue-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", SK: "1234", queueUrl: "", frequencyInSeconds: 30 },
        { subcriptionPK: "123", SK: "1234", queueUrl: "invalid-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", SK: "1234", queueUrl: "https://mock-queue-url", frequencyInSeconds: 5 },
    ])("throws an error when the message is invalid (test: %o)", async (message) => {
        mockEvent = message as AvlSubscriptionTriggerMessage as unknown as Parameters<typeof handler>[0];

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrowError();

        expect(sendBatchMessageSpy).not.toHaveBeenCalled();
    });

    it("throws an error when the SQS send message command fails", async () => {
        sendBatchMessageSpy.mockRejectedValue(new Error());

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrowError(Error);

        expect(sendBatchMessageSpy).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            expect.anything(),
            "There was a problem with AVL Consumer Subscription Trigger Lambda",
        );
    });

    it("sends data and heartbeat messages to the SQS queue", async () => {
        await handler(mockEvent, mockContext, mockCallback);

        const expectedDataMessage: AvlSubscriptionDataSenderMessage = {
            subscriptionPK: "123",
            SK: "1234",
            messageType: "data",
        };

        const expectedHeartbeatMessage: AvlSubscriptionDataSenderMessage = {
            subscriptionPK: "123",
            SK: "1234",
            messageType: "heartbeat",
        };

        const expectedMessages: SendMessageBatchRequestEntry[] = [
            { Id: "0", DelaySeconds: 0, MessageBody: JSON.stringify(expectedDataMessage) },
            { Id: "1", DelaySeconds: 20, MessageBody: JSON.stringify(expectedDataMessage) },
            { Id: "2", DelaySeconds: 40, MessageBody: JSON.stringify(expectedDataMessage) },
            { Id: "3", DelaySeconds: 0, MessageBody: JSON.stringify(expectedHeartbeatMessage) },
            { Id: "4", DelaySeconds: 30, MessageBody: JSON.stringify(expectedHeartbeatMessage) },
        ];

        expect(sendBatchMessageSpy).toHaveBeenCalledWith("https://mock-queue-url", expectedMessages);
        expect(logger.error).not.toHaveBeenCalled();
    });
});
