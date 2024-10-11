import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../avl-consumer-subscriptions";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";
const mockUserId = "mock-user-id-1";

const consumerSubscriptions: AvlConsumerSubscription[] = [
    {
        PK: "1",
        SK: mockUserId,
        subscriptionId: "1",
        status: "live",
        url: "https://www.test.com/data",
        requestorRef: "test",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
    {
        PK: "2",
        SK: mockUserId,
        subscriptionId: "2",
        status: "inactive",
        url: "https://www.test.com/data",
        requestorRef: "test",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
    {
        PK: "3",
        SK: mockUserId,
        subscriptionId: "3",
        status: "error",
        url: "https://www.test.com/data",
        requestorRef: "test",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
        eventSourceMappingUuid: "mockEventSourceMappingUuid",
        scheduleName: "mockScheduleName",
        queryParams: {
            subscriptionId: ["1"],
        },
    },
    {
        PK: "4",
        SK: "mock-user-id-2",
        subscriptionId: "1",
        status: "live",
        url: "https://www.test.com/data",
        requestorRef: "test",
        heartbeatInterval: "PT30S",
        initialTerminationTime: "2034-03-11T15:20:02.093Z",
        requestTimestamp: "2024-03-11T15:20:02.093Z",
        heartbeatAttempts: 0,
        lastRetrievedAvlId: 0,
        queueUrl: "https://mockQueueUrl",
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
        recursiveScan: vi.fn(),
    }));

    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;

        mockEvent = {
            headers: {
                "x-user-id": mockUserId,
            },
        } as unknown as APIGatewayProxyEvent;

        recursiveScanSpy.mockResolvedValue(consumerSubscriptions.filter((sub) => sub.SK === mockUserId));
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
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    it.each([
        [{}, ["x-user-id header is required"]],
        [{ "x-user-id": "" }, ["x-user-id header must be 1-256 characters"]],
        [{ "x-user-id": "1".repeat(257) }, ["x-user-id header must be 1-256 characters"]],
    ])("returns a 400 when the x-user-id header is invalid (test: %o)", async (headers, expectedErrorMessages) => {
        mockEvent.headers = headers;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: expectedErrorMessages }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), "Invalid request");
        expect(recursiveScanSpy).not.toHaveBeenCalled();
    });

    it("returns a 200 with the user's subscriptions when the request is valid", async () => {
        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 200,
            body: JSON.stringify(consumerSubscriptions.slice(0, 3)),
        });
    });
});
