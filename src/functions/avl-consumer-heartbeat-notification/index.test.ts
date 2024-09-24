import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import axios, { AxiosError } from "axios";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../avl-consumer-heartbeat-notification";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";

describe("avl-consumer-heartbeat-notification", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        recursiveScan: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    const mockedAxios = vi.mocked(axios, true);
    const axiosSpy = vi.spyOn(mockedAxios, "post");
    MockDate.set("2024-03-11T15:20:02.093Z");

    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;

        recursiveScanSpy.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("throws an error when the required env var AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrowError(Error);

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the avl-consumer-heartbeat-notification endpoint",
        );
    });

    it("sends heartbeats to each live subscription", async () => {
        const subscriptions: AvlConsumerSubscription[] = [
            {
                PK: "1234",
                SK: "100",
                subscriptionId: "1234",
                status: "live",
                url: "https://example.com",
                requestorRef: "1",
                heartbeatInterval: "PT30S",
                initialTerminationTime: "2024-03-11T15:20:02.093Z",
                requestTimestamp: "2024-03-11T15:20:02.093Z",
                heartbeatAttempts: 0,
                lastRetrievedAvlId: 0,
                queueUrl: "",
                eventSourceMappingUuid: "",
                scheduleName: "",
                queryParams: {
                    producerSubscriptionIds: ["1"],
                },
            },
        ];

        recursiveScanSpy.mockResolvedValueOnce(subscriptions);
        mockedAxios.post.mockResolvedValueOnce({ status: 200 });

        await handler(mockEvent, mockContext, mockCallback);

        const expectedRequestBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <HeartbeatNotification>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ProducerRef>${subscriptions[0].subscriptionId}</ProducerRef>
    <Status>true</Status>
    <ServiceStartedTime>2024-03-11T15:20:02.093Z</ServiceStartedTime>
  </HeartbeatNotification>
</Siri>
`;

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(axiosSpy).toHaveBeenCalledWith(subscriptions[0].url, expectedRequestBody, {
            headers: {
                "Content-Type": "text/xml",
            },
        });
        expect(logger.warn).not.toHaveBeenCalled();
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("increments the heartbeat attempts for a subscription when an unsuccessful request occurs", async () => {
        const subscription: AvlConsumerSubscription = {
            PK: "1234",
            SK: "100",
            subscriptionId: "1234",
            status: "live",
            url: "https://example.com",
            requestorRef: "1",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
            queryParams: {
                producerSubscriptionIds: ["1"],
            },
        };

        recursiveScanSpy.mockResolvedValueOnce([subscription]);
        mockedAxios.post.mockRejectedValue(new AxiosError("Request failed with status code 500", "500"));

        await handler(mockEvent, mockContext, mockCallback);

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            `Unsuccessful heartbeat notification response from subscription ${subscription.subscriptionId}, code: 500, message: Request failed with status code 500`,
        );

        const expectedSubscription: AvlConsumerSubscription = {
            ...subscription,
            heartbeatAttempts: 1,
        };

        expect(putDynamoItemSpy).toHaveBeenCalledTimes(1);
        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            subscription.PK,
            subscription.SK,
            expectedSubscription,
        );
    });

    it("sets a subscription status to error when 3 or more failed heartbeat attempts occur", async () => {
        const subscription: AvlConsumerSubscription = {
            PK: "1234",
            SK: "100",
            subscriptionId: "1234",
            status: "live",
            url: "https://example.com",
            requestorRef: "1",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 2,
            lastRetrievedAvlId: 0,
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
            queryParams: {
                producerSubscriptionIds: ["1"],
            },
        };

        recursiveScanSpy.mockResolvedValueOnce([subscription]);
        mockedAxios.post.mockRejectedValue(new AxiosError("Request failed with status code 500", "500"));

        await handler(mockEvent, mockContext, mockCallback);

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            `Unsuccessful heartbeat notification response from subscription ${subscription.subscriptionId}, code: 500, message: Request failed with status code 500`,
        );

        const expectedSubscription: AvlConsumerSubscription = {
            ...subscription,
            heartbeatAttempts: 3,
            status: "error",
        };

        expect(putDynamoItemSpy).toHaveBeenCalledTimes(1);
        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            subscription.PK,
            subscription.SK,
            expectedSubscription,
        );
    });

    it("resets the heartbeat attempts for a subscription when an successful request occurs", async () => {
        const subscription: AvlConsumerSubscription = {
            PK: "1234",
            SK: "100",
            subscriptionId: "1234",
            status: "live",
            url: "https://example.com",
            requestorRef: "1",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 1,
            lastRetrievedAvlId: 0,
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
            queryParams: {
                producerSubscriptionIds: ["1"],
            },
        };

        recursiveScanSpy.mockResolvedValueOnce([subscription]);
        mockedAxios.post.mockResolvedValueOnce({ status: 200 });

        await handler(mockEvent, mockContext, mockCallback);

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();

        const expectedSubscription: AvlConsumerSubscription = {
            ...subscription,
            heartbeatAttempts: 0,
            status: "live",
        };

        expect(putDynamoItemSpy).toHaveBeenCalledTimes(1);
        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            subscription.PK,
            subscription.SK,
            expectedSubscription,
        );
    });

    it("suppresses unexpected error when sending a heartbeat notifications, and logs the error", async () => {
        const subscription: AvlConsumerSubscription = {
            PK: "1234",
            SK: "100",
            subscriptionId: "1234",
            status: "live",
            url: "https://example.com",
            requestorRef: "1",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 1,
            lastRetrievedAvlId: 0,
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
            queryParams: {
                producerSubscriptionIds: ["1"],
            },
        };

        recursiveScanSpy.mockResolvedValueOnce([subscription]);
        putDynamoItemSpy.mockRejectedValueOnce(new Error());
        mockedAxios.post.mockResolvedValueOnce({ status: 200 });

        await handler(mockEvent, mockContext, mockCallback);

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            expect.anything(),
            `Unhandled error sending heartbeat notification to subscription ${subscription.subscriptionId}`,
        );
    });
});
