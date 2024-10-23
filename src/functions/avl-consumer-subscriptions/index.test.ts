import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAvlConsumerSubscription, handler } from "../avl-consumer-subscriptions";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";
const mockApiKey = "mock-api-key-1";
const mockSubscriptionId = "2";

const consumerSubscriptions: AvlConsumerSubscription[] = [
    {
        PK: "1",
        SK: mockApiKey,
        name: "consumer-sub-1",
        subscriptionId: "1",
        status: "live",
        url: "https://www.test.com/data",
        requestorRef: "test",
        updateInterval: "PT10S",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        queueAlarmName: "mockQueueAlarmName",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
    {
        PK: "2",
        SK: mockApiKey,
        name: "consumer-sub-2",
        subscriptionId: mockSubscriptionId,
        status: "inactive",
        url: "https://www.test.com/data",
        requestorRef: "test",
        updateInterval: "PT10S",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        queueAlarmName: "mockQueueAlarmName",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
    {
        PK: "3",
        SK: mockApiKey,
        name: "consumer-sub-3",
        subscriptionId: "3",
        status: "error",
        url: "https://www.test.com/data",
        requestorRef: "test",
        updateInterval: "PT10S",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        queueAlarmName: "mockQueueAlarmName",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
    {
        PK: "4",
        SK: "mock-api-key-2",
        name: "consumer-sub-4",
        subscriptionId: "1",
        status: "live",
        url: "https://www.test.com/data",
        requestorRef: "test",
        updateInterval: "PT10S",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        queueAlarmName: "mockQueueAlarmName",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
];

describe("avl-consumer-subscriptions", () => {
    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        recursiveQuery: vi.fn(),
        recursiveScan: vi.fn(),
    }));

    const recursiveQuerySpy = vi.spyOn(dynamo, "recursiveQuery");
    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;

        mockEvent = {
            headers: {
                "x-api-key": mockApiKey,
            },
        } as unknown as APIGatewayProxyEvent;

        recursiveQuerySpy.mockResolvedValue(
            consumerSubscriptions.filter((sub) => sub.subscriptionId === mockSubscriptionId),
        );
        recursiveScanSpy.mockResolvedValue(consumerSubscriptions.filter((sub) => sub.SK === mockApiKey));
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("returns a 500 when the required env var AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the avl-consumer-subscriptions endpoint",
        );

        expect(recursiveQuerySpy).not.toHaveBeenCalled();
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    it.each([
        [{}, ["x-api-key header is required"]],
        [{ "x-api-key": "" }, ["x-api-key header must be 1-256 characters"]],
        [{ "x-api-key": "1".repeat(257) }, ["x-api-key header must be 1-256 characters"]],
    ])("returns a 400 when the x-api-key header is invalid (test: %o)", async (headers, expectedErrorMessages) => {
        mockEvent.headers = headers;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: expectedErrorMessages }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), "Invalid request");

        expect(recursiveQuerySpy).not.toHaveBeenCalled();
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    it.each([[null], [{}], [{ subscriptionId: "" }]])(
        "returns a 200 with all subscriptions data when passing no subscription ID param (test: %o)",
        async (input) => {
            const expectedResponse: ApiAvlConsumerSubscription[] = [
                {
                    id: "1",
                    name: "consumer-sub-1",
                    subscriptionId: "1",
                    status: "live",
                    url: "https://www.test.com/data",
                    requestorRef: "test",
                    updateInterval: "PT10S",
                    heartbeatInterval: "PT30S",
                    initialTerminationTime: "2034-03-11T15:20:02.093Z",
                    requestTimestamp: "2024-03-11T15:20:02.093Z",
                    queryParams: {
                        subscriptionId: ["1"],
                    },
                },
                {
                    id: "2",
                    name: "consumer-sub-2",
                    subscriptionId: "2",
                    status: "inactive",
                    url: "https://www.test.com/data",
                    requestorRef: "test",
                    updateInterval: "PT10S",
                    heartbeatInterval: "PT30S",
                    initialTerminationTime: "2034-03-11T15:20:02.093Z",
                    requestTimestamp: "2024-03-11T15:20:02.093Z",
                    queryParams: {
                        subscriptionId: ["1"],
                    },
                },
                {
                    id: "3",
                    name: "consumer-sub-3",
                    subscriptionId: "3",
                    status: "error",
                    url: "https://www.test.com/data",
                    requestorRef: "test",
                    updateInterval: "PT10S",
                    heartbeatInterval: "PT30S",
                    initialTerminationTime: "2034-03-11T15:20:02.093Z",
                    requestTimestamp: "2024-03-11T15:20:02.093Z",
                    queryParams: {
                        subscriptionId: ["1"],
                    },
                },
            ];

            mockEvent.queryStringParameters = input;

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({
                statusCode: 200,
                body: JSON.stringify(expectedResponse),
            });

            expect(recursiveQuerySpy).not.toHaveBeenCalled();
            expect(recursiveScanSpy).toHaveBeenCalled();
        },
    );

    it("returns a 200 with a single subscription when passing a subscription ID param", async () => {
        const expectedResponse: ApiAvlConsumerSubscription = {
            id: "2",
            name: "consumer-sub-2",
            subscriptionId: mockSubscriptionId,
            status: "inactive",
            url: "https://www.test.com/data",
            requestorRef: "test",
            updateInterval: "PT10S",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2034-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            queryParams: {
                subscriptionId: ["1"],
            },
        };

        mockEvent.queryStringParameters = {
            subscriptionId: mockSubscriptionId,
        };

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 200,
            body: JSON.stringify(expectedResponse),
        });

        expect(recursiveQuerySpy).toHaveBeenCalled();
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    it("returns a 404 when querying a subscription that does not exist", async () => {
        mockEvent.queryStringParameters = {
            subscriptionId: mockSubscriptionId,
        };

        recursiveQuerySpy.mockResolvedValue([]);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });

        expect(recursiveQuerySpy).toHaveBeenCalled();
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });
});
