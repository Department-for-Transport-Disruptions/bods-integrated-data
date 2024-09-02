import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription, AvlSubscription } from "@bods-integrated-data/shared/schema";
import { APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

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
      <SubscriptionIdentifier>1234</SubscriptionIdentifier>
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

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
        putDynamoItem: vi.fn(),
        recursiveScan: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");

    const mockSubscriptionId = "1";
    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "mock-consumer-table";
        process.env.AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME = "mock-producer-table";

        mockEvent = {
            queryStringParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: mockRequestBody,
        } as unknown as APIGatewayProxyEvent;

        getDynamoItemSpy.mockResolvedValue(null);
        recursiveScanSpy.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("returns a 500 when the required env var AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the avl-consumer-subscriber endpoint",
            expect.any(Error),
        );
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 500 when the required env var AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the avl-consumer-subscriber endpoint",
            expect.any(Error),
        );
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
        expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 400 when the body is empty", async () => {
        mockEvent.body = null;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Body must be a string"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 400 when the body is an invalid siri-vm subscription request", async () => {
        mockEvent.body = "invalid xml";

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid SIRI-VM XML provided"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith("Invalid SIRI-VM XML provided", expect.anything());
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });

    it("returns a 409 when the consumer subscription is already live", async () => {
        const consumerSubscription: AvlConsumerSubscription = {
            subscriptionId: "1234",
            status: "live",
            url: "https://example.com",
            requestorRef: "123",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2024-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            producerSubscriptionIds: "1",
            heartbeatAttempts: 0,
        };

        getDynamoItemSpy.mockResolvedValueOnce(consumerSubscription);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 409,
            body: JSON.stringify({ errors: ["Consumer subscription ID already active"] }),
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
            PK: "1",
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
            subscriptionId: "1234",
            status: "live",
            url: "https://www.test.com/data",
            requestorRef: "test",
            heartbeatInterval: "PT30S",
            initialTerminationTime: "2034-03-11T15:20:02.093Z",
            requestTimestamp: "2024-03-11T15:20:02.093Z",
            producerSubscriptionIds: "1",
            heartbeatAttempts: 0,
        };

        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            "mock-consumer-table",
            "1234",
            "SUBSCRIPTION",
            consumerSubscription,
        );
    });
});
