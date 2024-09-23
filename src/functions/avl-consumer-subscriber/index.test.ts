import { AvlSubscriptionTriggerMessage } from "@bods-integrated-data/shared/avl-consumer/utils";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as eventBridge from "@bods-integrated-data/shared/eventBridge";
import * as lambda from "@bods-integrated-data/shared/lambda";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription, AvlSubscription } from "@bods-integrated-data/shared/schema";
import * as sqs from "@bods-integrated-data/shared/sqs";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";
const mockProducerSubscriptionTable = "mock-producer-subscription-table-name";
const mockConsumerSubscriptionId = "mock-consumer-subscription-id";
const mockProducerSubscriptionId = "1";
const mockUserId = "mock-user-id";
const mockRandomId = "999";
const mockQueueUrl = "https://mockQueueUrl";
const mockQueueArn = "mockQueueArn";
const mockSendDataLambdaArn = "mockSendDataLambdaArn";
const mockEventSourceMappingUuid = "mockEventSourceMappingUuid";
const mockSubscriptionTriggerLambdaArn = "mockSubscriptionTriggerLambdaArn";
const mockSubscriptionScheduleRoleArn = "mockSubscriptionScheduleRoleArn";

const mockRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <SubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ConsumerAddress>https://www.test.com/data</ConsumerAddress>
    <RequestorRef>test</RequestorRef>
    <MessageIdentifier>123</MessageIdentifier>
    <SubscriptionContext>
      <HeartbeatInterval>PT30S</HeartbeatInterval>
    </SubscriptionContext>
    <VehicleMonitoringSubscriptionRequest>
      <SubscriptionIdentifier>${mockConsumerSubscriptionId}</SubscriptionIdentifier>
      <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
      <VehicleMonitoringRequest version=\"2.0\">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
        <VehicleMonitoringDetailLevel>normal</VehicleMonitoringDetailLevel>
      </VehicleMonitoringRequest>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;

describe("avl-consumer-subscriber", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("node:crypto", () => ({
        randomUUID: () => mockRandomId,
    }));

    const recursiveQuerySpy = vi.spyOn(dynamo, "recursiveQuery");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const createQueueSpy = vi.spyOn(sqs, "createQueue");
    const getQueueAttributesSpy = vi.spyOn(sqs, "getQueueAttributes");
    const createEventSourceMappingSpy = vi.spyOn(lambda, "createEventSourceMapping");
    const createScheduleSpy = vi.spyOn(eventBridge, "createSchedule");

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;
        process.env.AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME = mockProducerSubscriptionTable;
        process.env.AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN = mockSendDataLambdaArn;
        process.env.AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN = mockSubscriptionTriggerLambdaArn;
        process.env.AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN = mockSubscriptionScheduleRoleArn;

        mockEvent = {
            headers: {
                userId: mockUserId,
            },
            queryStringParameters: {
                subscriptionId: mockProducerSubscriptionId,
            },
            body: mockRequestBody,
        } as unknown as APIGatewayProxyEvent;

        recursiveQuerySpy.mockResolvedValue([]);
        recursiveScanSpy.mockResolvedValue([]);
        putDynamoItemSpy.mockResolvedValue();
        createQueueSpy.mockResolvedValue(mockQueueUrl);
        getQueueAttributesSpy.mockResolvedValue({ QueueArn: mockQueueArn });
        createEventSourceMappingSpy.mockResolvedValue(mockEventSourceMappingUuid);
        createScheduleSpy.mockResolvedValue("");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it.each([
        "AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME",
        "AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME",
        "AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN",
        "AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN",
        "AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN",
    ])("returns a 500 when the required env var %s is missing", async (input) => {
        process.env[input] = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the avl-consumer-subscriber endpoint",
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

    it.each([
        [undefined, "subscriptionId is required"],
        [
            "1,",
            "subscriptionId must be a valid ID format or a comma-delimited array of valid ID formats up to five IDs",
        ],
        [
            "asdf!",
            "subscriptionId must be a valid ID format or a comma-delimited array of valid ID formats up to five IDs",
        ],
    ])("returns a 400 when the subscriptionId query param is invalid", async (subscriptionId, expectedErrorMessage) => {
        mockEvent.queryStringParameters = {
            subscriptionId,
        };
        mockEvent.body = mockRequestBody;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: [expectedErrorMessage] }),
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

        const errorMessage = 'Validation error: Required at "Siri"';

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: [errorMessage] }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), `Invalid SIRI-VM XML provided: ${errorMessage}`);
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 400 when a disallowed UpdateInterval is used", async () => {
        mockEvent.body = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <SubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ConsumerAddress>https://www.test.com/data</ConsumerAddress>
    <RequestorRef>test</RequestorRef>
    <MessageIdentifier>123</MessageIdentifier>
    <SubscriptionContext>
      <HeartbeatInterval>PT30S</HeartbeatInterval>
    </SubscriptionContext>
    <VehicleMonitoringSubscriptionRequest>
      <SubscriptionIdentifier>${mockConsumerSubscriptionId}</SubscriptionIdentifier>
      <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
      <VehicleMonitoringRequest version=\"2.0\">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
        <VehicleMonitoringDetailLevel>normal</VehicleMonitoringDetailLevel>
      </VehicleMonitoringRequest>
      <UpdateInterval>PT25S</UpdateInterval>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;
        const errorMessage =
            "Validation error: Invalid enum value. Expected 'PT10S' | 'PT15S' | 'PT20S' | 'PT30S', received 'PT25S' at \"Siri.SubscriptionRequest.VehicleMonitoringSubscriptionRequest.UpdateInterval\"";

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({
                errors: [errorMessage],
            }),
        });
        expect(logger.warn).toHaveBeenCalledWith(expect.anything(), `Invalid SIRI-VM XML provided: ${errorMessage}`);
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 409 when the consumer subscription is already live", async () => {
        const consumerSubscription: AvlConsumerSubscription = {
            PK: mockRandomId,
            SK: mockUserId,
            subscriptionId: mockConsumerSubscriptionId,
            status: "live",
            url: "https://example.com",
            requestorRef: "123",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
            queryParams: {
                producerSubscriptionIds: mockProducerSubscriptionId,
            },
        };

        recursiveQuerySpy.mockResolvedValueOnce([consumerSubscription]);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 409,
            body: JSON.stringify({ errors: ["Consumer subscription ID is already live"] }),
        });
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 404 when at least one of the producer subscriptions cannot be found", async () => {
        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Producer subscription ID not found: 1"] }),
        });
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 404 when at least one of the producer subscriptions is inactive", async () => {
        const producerSubscription: AvlSubscription = {
            PK: "2",
            description: "test-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "inactive",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        recursiveScanSpy.mockResolvedValueOnce([producerSubscription]);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Producer subscription ID not found: 1"] }),
        });
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 200 and creates a new consumer subscription when the request is valid", async () => {
        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionId,
            description: "test-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "live",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        recursiveScanSpy.mockResolvedValueOnce([producerSubscription]);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 200,
            body: "",
        });

        const consumerSubscription: AvlConsumerSubscription = {
            PK: mockRandomId,
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
            queueUrl: mockQueueUrl,
            eventSourceMappingUuid: mockEventSourceMappingUuid,
            scheduleName: `consumer-sub-schedule-${mockRandomId}`,
            queryParams: {
                producerSubscriptionIds: mockProducerSubscriptionId,
            },
        };

        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            consumerSubscription.PK,
            consumerSubscription.SK,
            consumerSubscription,
        );

        expect(createQueueSpy).toHaveBeenCalledWith({
            QueueName: `consumer-sub-queue-${mockRandomId}`,
            Attributes: {
                VisibilityTimeout: "60",
            },
        });

        expect(getQueueAttributesSpy).toHaveBeenCalledWith({
            QueueUrl: mockQueueUrl,
            AttributeNames: ["QueueArn"],
        });

        expect(createEventSourceMappingSpy).toHaveBeenCalledWith({
            EventSourceArn: mockQueueArn,
            FunctionName: mockSendDataLambdaArn,
        });

        const queueMessage: AvlSubscriptionTriggerMessage = {
            subscriptionPK: consumerSubscription.PK,
            SK: consumerSubscription.SK,
            frequencyInSeconds: 10,
            queueUrl: mockQueueUrl,
        };

        expect(createScheduleSpy).toHaveBeenCalledWith({
            Name: `consumer-sub-schedule-${mockRandomId}`,
            FlexibleTimeWindow: {
                Mode: "OFF",
            },
            ScheduleExpression: "rate(1 minute)",
            Target: {
                Arn: mockSubscriptionTriggerLambdaArn,
                RoleArn: mockSubscriptionScheduleRoleArn,
                Input: JSON.stringify(queueMessage),
            },
        });
    });

    it("returns a 200 and overwrites an existing consumer subscription when the request is valid when resubscribing", async () => {
        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionId,
            description: "test-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "live",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        recursiveScanSpy.mockResolvedValueOnce([producerSubscription]);

        const consumerSubscription: AvlConsumerSubscription = {
            PK: mockRandomId,
            SK: mockUserId,
            subscriptionId: mockConsumerSubscriptionId,
            status: "error",
            url: "https://www.test.com/data",
            requestorRef: "test",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2034-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: mockQueueUrl,
            eventSourceMappingUuid: mockEventSourceMappingUuid,
            scheduleName: `consumer-sub-schedule-${mockRandomId}`,
            queryParams: {
                producerSubscriptionIds: mockProducerSubscriptionId,
            },
        };

        recursiveQuerySpy.mockResolvedValueOnce([consumerSubscription]);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 200,
            body: "",
        });

        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            consumerSubscription.PK,
            consumerSubscription.SK,
            {
                ...consumerSubscription,
                status: "live",
            },
        );
    });
});
