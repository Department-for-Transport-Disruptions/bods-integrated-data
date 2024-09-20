import { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import { AvlSubscriptionTriggerMessage } from "@bods-integrated-data/shared/avl-consumer/utils";
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
            queueUrl: "mock-queue-url",
            frequencyInSeconds: 30,
        } as AvlSubscriptionTriggerMessage as unknown as Parameters<typeof handler>[0];
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it.each([
        {},
        { queueUrl: "mock-queue-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", frequencyInSeconds: 30 },
        { subcriptionPK: "123", queueUrl: "mock-queue-url" },
        { subcriptionPK: "", queueUrl: "mock-queue-url", frequencyInSeconds: 30 },
        { subcriptionPK: "123", queueUrl: "", frequencyInSeconds: 30 },
        { subcriptionPK: "123", queueUrl: "mock-queue-url", frequencyInSeconds: 5 },
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

    it("sends messages to the SQS queue", async () => {
        await handler(mockEvent, mockContext, mockCallback);

        const expectedMessages: SendMessageBatchRequestEntry[] = [
            {
                Id: "0",
                DelaySeconds: 30,
                MessageBody: JSON.stringify({ subscriptionPK: "123" }),
            },
            {
                Id: "1",
                DelaySeconds: 60,
                MessageBody: JSON.stringify({ subscriptionPK: "123" }),
            },
        ];

        expect(sendBatchMessageSpy).toHaveBeenCalledWith("mock-queue-url", expectedMessages);
        expect(logger.error).not.toHaveBeenCalled();
    });
});
