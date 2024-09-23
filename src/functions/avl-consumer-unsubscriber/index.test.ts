import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as eventBridge from "@bods-integrated-data/shared/eventBridge";
import * as lambda from "@bods-integrated-data/shared/lambda";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import * as sqs from "@bods-integrated-data/shared/sqs";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../avl-consumer-unsubscriber";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";
const mockConsumerSubscriptionId = "mock-consumer-subscription-id";
const mockUserId = "mock-user-id";

const consumerSubscription: AvlConsumerSubscription = {
    PK: mockConsumerSubscriptionId,
    SK: mockUserId,
    subscriptionId: mockConsumerSubscriptionId,
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
        producerSubscriptionIds: "1",
    },
};

const mockRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\"
  xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
  xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <TerminateSubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <RequestorRef>BODS</RequestorRef>
    <MessageIdentifier>1</MessageIdentifier>
    <SubscriptionRef>${mockConsumerSubscriptionId}</SubscriptionRef>
  </TerminateSubscriptionRequest>
</Siri>
`;

describe("avl-consumer-unsubscriber", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        recursiveQuery: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    const recursiveQuerySpy = vi.spyOn(dynamo, "recursiveQuery");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const deleteQueueSpy = vi.spyOn(sqs, "deleteQueue");
    const deleteEventSourceMappingSpy = vi.spyOn(lambda, "deleteEventSourceMapping");
    const deleteScheduleSpy = vi.spyOn(eventBridge, "deleteSchedule");

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;

        mockEvent = {
            headers: {
                userId: mockUserId,
            },
            body: mockRequestBody,
        } as unknown as APIGatewayProxyEvent;

        recursiveQuerySpy.mockResolvedValue([consumerSubscription]);
        deleteQueueSpy.mockResolvedValue({ $metadata: {} });
        deleteEventSourceMappingSpy.mockResolvedValue({ $metadata: {} });
        deleteScheduleSpy.mockResolvedValue({ $metadata: {} });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("returns a 500 when the required env var AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the avl-consumer-unsubscriber endpoint",
        );
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it.each([
        [{}, ["userId header is required"]],
        [{ userId: "" }, ["userId header must be 1-256 characters"]],
        [{ userId: "1".repeat(257) }, ["userId header must be 1-256 characters"]],
    ])("returns a 400 when the userId header is invalid (test: %o)", async (headers, expectedErrorMessages) => {
        mockEvent.headers = headers;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: expectedErrorMessages }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), "Invalid request");
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 400 when the body is empty", async () => {
        mockEvent.body = null;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Body must be a string"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), "Invalid request");
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 400 when the body is an invalid siri-vm subscription request", async () => {
        mockEvent.body = "invalid xml";

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid SIRI-VM XML provided"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), "Invalid SIRI-VM XML provided");
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 404 when the subscription cannot be found", async () => {
        recursiveQuerySpy.mockResolvedValue([]);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(expect.anything(), "Subscription not found");
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 204 and sets the subscription status to inactive when the request is valid", async () => {
        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 204,
            body: "",
        });

        const updatedConsumerSubscription: AvlConsumerSubscription = {
            ...consumerSubscription,
            status: "inactive",
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
        };

        expect(deleteQueueSpy).toHaveBeenCalledWith({ QueueUrl: consumerSubscription.queueUrl });
        expect(deleteEventSourceMappingSpy).toHaveBeenCalledWith({ UUID: consumerSubscription.eventSourceMappingUuid });
        expect(deleteScheduleSpy).toHaveBeenCalledWith({ Name: consumerSubscription.scheduleName });
        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            consumerSubscription.PK,
            consumerSubscription.SK,
            updatedConsumerSubscription,
        );
    });

    it("logs an error when the schedule cannot be deleted", async () => {
        deleteQueueSpy.mockRejectedValue(new Error());
        deleteEventSourceMappingSpy.mockRejectedValue(new Error());
        deleteScheduleSpy.mockRejectedValue(new Error());

        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.error).toHaveBeenNthCalledWith(
            1,
            expect.any(Error),
            `Error deleting schedule with name: ${consumerSubscription.scheduleName}`,
        );
        expect(logger.error).toHaveBeenNthCalledWith(
            2,
            expect.any(Error),
            `Error deleting event source mapping with UUID: ${consumerSubscription.eventSourceMappingUuid}`,
        );
        expect(logger.error).toHaveBeenNthCalledWith(
            3,
            expect.any(Error),
            `Error deleting queue with URL: ${consumerSubscription.queueUrl}`,
        );
        expect(putDynamoItemSpy).toHaveBeenCalled();
    });
});
