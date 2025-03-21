import { TooManyRequestsException } from "@aws-sdk/client-lambda";
import { QueueDeletedRecently } from "@aws-sdk/client-sqs";
import { AvlSubscriptionTriggerMessage } from "@bods-integrated-data/shared/avl-consumer/utils";
import * as cloudwatch from "@bods-integrated-data/shared/cloudwatch";
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
const mockProducerSubscriptionIds = "1";
const mockApiKey = "mock-api-key";
const mockRandomId = "999";
const mockQueueUrl = "https://mockQueueUrl";
const mockQueueArn = "mockQueueArn";
const mockSendDataLambdaArn = "mockSendDataLambdaArn";
const mockEventSourceMappingUuid = "mockEventSourceMappingUuid";
const mockSubscriptionTriggerLambdaArn = "mockSubscriptionTriggerLambdaArn";
const mockSubscriptionScheduleRoleArn = "mockSubscriptionScheduleRoleArn";
const mockAlarmTopicArn = "mockAlarmTopicArn";
const mockOkTopicArn = "mockOkTopicArn";

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
    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        createAlarm: vi.fn(),
        putMetricData: vi.fn(),
    }));

    vi.mock("node:crypto", () => ({
        randomUUID: () => mockRandomId,
    }));

    const recursiveQuerySpy = vi.spyOn(dynamo, "recursiveQuery");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const createQueueSpy = vi.spyOn(sqs, "createQueue");
    const getQueueAttributesSpy = vi.spyOn(sqs, "getQueueAttributes");
    const createAlarmSpy = vi.spyOn(cloudwatch, "createAlarm");
    const createEventSourceMappingSpy = vi.spyOn(lambda, "createEventSourceMapping");
    const createScheduleSpy = vi.spyOn(eventBridge, "createSchedule");

    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;
        process.env.AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME = mockProducerSubscriptionTable;
        process.env.AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN = mockSendDataLambdaArn;
        process.env.AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN = mockSubscriptionTriggerLambdaArn;
        process.env.AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN = mockSubscriptionScheduleRoleArn;
        process.env.ALARM_TOPIC_ARN = mockAlarmTopicArn;
        process.env.OK_TOPIC_ARN = mockOkTopicArn;

        mockEvent = {
            headers: {
                "x-api-key": mockApiKey,
            },
            queryStringParameters: {
                name: "consumer-sub-1",
                boundingBox: "1,2,3,4",
                operatorRef: "a,b,c",
                vehicleRef: "vehicle-ref",
                lineRef: "line-ref",
                producerRef: "producer-ref",
                originRef: "origin-ref",
                destinationRef: "destination-ref",
                subscriptionId: mockProducerSubscriptionIds,
            },
            body: mockRequestBody,
        } as unknown as APIGatewayProxyEvent;

        recursiveQuerySpy.mockResolvedValue([]);
        recursiveScanSpy.mockResolvedValue([]);
        putDynamoItemSpy.mockResolvedValue();
        createQueueSpy.mockResolvedValue(mockQueueUrl);
        getQueueAttributesSpy.mockResolvedValue({ QueueArn: mockQueueArn });
        createAlarmSpy.mockResolvedValue({ $metadata: {} });
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
        "ALARM_TOPIC_ARN",
        "OK_TOPIC_ARN",
    ])("returns a 500 when the required env var %s is missing", async (input) => {
        process.env[input] = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            new Error(
                "Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME, AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME, AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN, AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN, AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN, ALARM_TOPIC_ARN and OK_TOPIC_ARN must be set",
            ),
            "There was a problem with the avl-consumer-subscriber endpoint",
        );
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
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
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it.each([
        [
            { subscriptionId: "1," },
            ["subscriptionId must be a valid ID format or a comma-delimited array of valid ID formats up to five IDs"],
        ],
        [
            { subscriptionId: "," },
            ["subscriptionId must be a valid ID format or a comma-delimited array of valid ID formats up to five IDs"],
        ],
        [
            { subscriptionId: "1", boundingBox: "1234" },
            [
                "boundingBox must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude",
            ],
        ],
        [
            { subscriptionId: "1", operatorRef: "1," },
            [
                "operatorRef must be comma-separated values of 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
        ],
        [
            { subscriptionId: "1", vehicleRef: "" },
            [
                "vehicleRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
        ],
        [
            { subscriptionId: "1", lineRef: "" },
            [
                "lineRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
        ],
        [
            { subscriptionId: "1", producerRef: "" },
            [
                "producerRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
        ],
        [
            { subscriptionId: "1", originRef: "" },
            [
                "originRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
        ],
        [
            { subscriptionId: "1", destinationRef: "" },
            [
                "destinationRef must be 1-256 characters and only contain letters, numbers, periods, hyphens, underscores and colons",
            ],
        ],
    ])("returns a 400 when the %o query param is invalid", async (params, expectedErrors) => {
        mockEvent.queryStringParameters = params;
        mockEvent.body = mockRequestBody;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: expectedErrors }),
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
            SK: mockApiKey,
            name: "consumer-sub-1",
            subscriptionId: mockConsumerSubscriptionId,
            status: "live",
            url: "https://example.com",
            requestorRef: "123",
            updateInterval: "PT10S",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: undefined,
            queueAlarmName: undefined,
            eventSourceMappingUuid: undefined,
            scheduleName: undefined,
            queryParams: {
                subscriptionId: [mockProducerSubscriptionIds],
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

    it("returns a 503 when trying to resubscribe to an existing error subscription that was deactivated too recently", async () => {
        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionIds[0],
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
        createQueueSpy.mockRejectedValue(new QueueDeletedRecently({ message: "", $metadata: {} }));

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 503,
            headers: {
                "Retry-After": 60,
            },
            body: JSON.stringify({ errors: ["Existing subscription is still deactivating, try again later"] }),
        });
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 429 when hitting the AWS throttle limit creating resources", async () => {
        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionIds[0],
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
        createEventSourceMappingSpy.mockRejectedValue(new TooManyRequestsException({ message: "", $metadata: {} }));

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 429,
            headers: {
                "Retry-After": 60,
            },
            body: JSON.stringify({ errors: ["Too many subscribe requests, try again later"] }),
        });
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 200 and creates a new consumer subscription when the request is valid", async () => {
        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionIds[0],
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
            SK: mockApiKey,
            name: "consumer-sub-1",
            subscriptionId: mockConsumerSubscriptionId,
            status: "live",
            url: "https://www.test.com/data",
            requestorRef: "test",
            updateInterval: "PT10S",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2034-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: mockQueueUrl,
            queueAlarmName: `consumer-queue-alarm-${mockRandomId}`,
            eventSourceMappingUuid: mockEventSourceMappingUuid,
            scheduleName: `consumer-sub-schedule-${mockRandomId}`,
            queryParams: {
                boundingBox: [1, 2, 3, 4],
                operatorRef: ["a", "b", "c"],
                vehicleRef: "vehicle-ref",
                lineRef: "line-ref",
                producerRef: "producer-ref",
                originRef: "origin-ref",
                destinationRef: "destination-ref",
                subscriptionId: [mockProducerSubscriptionIds],
            },
        };

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

        expect(createAlarmSpy).toHaveBeenCalledWith({
            AlarmName: `consumer-queue-alarm-${mockRandomId}`,
            AlarmDescription: "Alarm when queue length exceeds 25",
            Statistic: "Sum",
            MetricName: "ApproximateNumberOfMessagesVisible",
            ComparisonOperator: "GreaterThanThreshold",
            Threshold: 25,
            Period: 60,
            EvaluationPeriods: 1,
            Namespace: "AWS/SQS",
            Dimensions: [
                {
                    Name: "QueueName",
                    Value: `consumer-sub-queue-${mockRandomId}`,
                },
            ],
            AlarmActions: [mockAlarmTopicArn, mockOkTopicArn],
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

        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            consumerSubscription.PK,
            consumerSubscription.SK,
            consumerSubscription,
        );
    });

    it("returns a 200 and overwrites an existing consumer subscription when the request is valid when resubscribing", async () => {
        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionIds[0],
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
            SK: mockApiKey,
            name: "consumer-sub-1",
            subscriptionId: mockConsumerSubscriptionId,
            status: "error",
            url: "https://www.test.com/data",
            requestorRef: "test",
            updateInterval: "PT10S",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2034-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: mockQueueUrl,
            queueAlarmName: `consumer-queue-alarm-${mockRandomId}`,
            eventSourceMappingUuid: mockEventSourceMappingUuid,
            scheduleName: `consumer-sub-schedule-${mockRandomId}`,
            queryParams: {
                boundingBox: [1, 2, 3, 4],
                operatorRef: ["a", "b", "c"],
                vehicleRef: "vehicle-ref",
                lineRef: "line-ref",
                producerRef: "producer-ref",
                originRef: "origin-ref",
                destinationRef: "destination-ref",
                subscriptionId: [mockProducerSubscriptionIds],
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

    it("sets a default subscription name when the name query param is omitted", async () => {
        mockEvent.queryStringParameters = {
            subscriptionId: mockProducerSubscriptionIds,
        };

        const producerSubscription: AvlSubscription = {
            PK: mockProducerSubscriptionIds[0],
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
            SK: mockApiKey,
            name: `subscription-${mockConsumerSubscriptionId}`,
            subscriptionId: mockConsumerSubscriptionId,
            status: "live",
            url: "https://www.test.com/data",
            requestorRef: "test",
            updateInterval: "PT10S",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2034-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: mockQueueUrl,
            queueAlarmName: `consumer-queue-alarm-${mockRandomId}`,
            eventSourceMappingUuid: mockEventSourceMappingUuid,
            scheduleName: `consumer-sub-schedule-${mockRandomId}`,
            queryParams: {
                subscriptionId: [mockProducerSubscriptionIds],
            },
        };

        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            consumerSubscription.PK,
            consumerSubscription.SK,
            consumerSubscription,
        );
    });
});
