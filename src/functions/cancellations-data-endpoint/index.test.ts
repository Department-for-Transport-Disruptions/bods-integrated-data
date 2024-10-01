import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import * as s3 from "@bods-integrated-data/shared/s3";
import { CancellationsSubscription } from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import { APIGatewayProxyEvent } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";
import {
    mockEmptySiri,
    mockHeartbeatNotification,
    testSiri,
    testSiriWithEmptyPtSituationElement,
    testSiriWithNoPtSituationElement,
    testSiriWithSelfClosingPtSituationElement,
    testSiriWithSinglePtSituationElement,
} from "./testSiriSx";

describe("cancellations-data-endpoint", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        putS3Object: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        putDynamoItem: vi.fn(),
        getDynamoItem: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");

    MockDate.set("2024-03-11T15:20:02.093Z");
    const mockSubscriptionId = "411e4495-4a57-4d2f-89d5-cf105441f321";
    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.BUCKET_NAME = "test-bucket";
        process.env.TABLE_NAME = "test-dynamodb";

        mockEvent = {
            queryStringParameters: {
                apiKey: "mock-api-key",
            },
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: testSiri,
        } as unknown as APIGatewayProxyEvent;

        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "live",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it.each(["live", "error"] as const)(
        "should add valid cancellations data to S3 if subscription status is %o",
        async (status) => {
            const cancellationsSubscription: CancellationsSubscription = {
                PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
                description: "test-description",
                lastCancellationsDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
                requestorRef: null,
                shortDescription: "test-short-description",
                status,
                url: "https://mock-data-producer.com/",
                publisherId: "test-publisher-id",
                apiKey: "mock-api-key",
            };

            getDynamoItemSpy.mockResolvedValue(cancellationsSubscription);

            await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({ statusCode: 200, body: "" });

            expect(s3.putS3Object).toHaveBeenCalled();
            expect(s3.putS3Object).toHaveBeenCalledWith({
                Body: `${testSiri}`,
                Bucket: "test-bucket",
                ContentType: "application/xml",
                Key: `${mockSubscriptionId}/2024-03-11T15:20:02.093Z.xml`,
            });

            expect(dynamo.putDynamoItem).toHaveBeenCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
                "test-dynamodb",
                cancellationsSubscription.PK,
                "SUBSCRIPTION",
                cancellationsSubscription,
            );
        },
    );

    it("should add valid cancellations data with a single PtSituationElement to S3", async () => {
        const subscription: CancellationsSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            lastCancellationsDataReceivedDateTime: "2024-03-11T00:00:00.000Z",
            status: "live",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };
        getDynamoItemSpy.mockResolvedValue(subscription);
        mockEvent.body = testSiriWithSinglePtSituationElement;

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({ statusCode: 200, body: "" });
        expect(s3.putS3Object).toHaveBeenCalled();
        expect(s3.putS3Object).toHaveBeenCalledWith({
            Body: `${testSiriWithSinglePtSituationElement}`,
            Bucket: "test-bucket",
            ContentType: "application/xml",
            Key: `${mockSubscriptionId}/2024-03-11T15:20:02.093Z.xml`,
        });

        expect(dynamo.putDynamoItem).toHaveBeenCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
            "test-dynamodb",
            subscription.PK,
            "SUBSCRIPTION",
            { ...subscription, lastCancellationsDataReceivedDateTime: "2024-03-11T15:20:02.093Z" },
        );
    });

    it("throws an error when the required env vars are missing", async () => {
        process.env.BUCKET_NAME = "";
        process.env.TABLE_NAME = "";
        mockEvent.body = testSiriWithSinglePtSituationElement;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("An unexpected error occurred");

        expect(s3.putS3Object).not.toHaveBeenCalled();
    });

    it.each([
        [undefined, "subscriptionId is required"],
        ["", "subscriptionId must be 1-256 characters"],
        ["1".repeat(257), "subscriptionId must be 1-256 characters"],
    ])(
        "Throws an error when the subscription ID fails validation (test: %o)",
        async (subscriptionId, expectedErrorMessage) => {
            mockEvent.pathParameters = {
                subscriptionId,
            };

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: [expectedErrorMessage] }),
            });
            expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), "Invalid request");
            expect(s3.putS3Object).not.toHaveBeenCalled();
        },
    );

    it.each([[null, "Body must be a string"]])(
        "throws an error when the body fails validation (test %#)",
        async (body, expectedErrorMessage) => {
            mockEvent.body = body;

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({ statusCode: 400, body: JSON.stringify({ errors: [expectedErrorMessage] }) });
            expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), "Invalid request");
            expect(s3.putS3Object).not.toHaveBeenCalled();
        },
    );

    it.each(["abc", mockEmptySiri])("does not throw an error when invalid XML is provided", async (input) => {
        mockEvent.body = input;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 200,
            body: "",
        });
        expect(logger.warn).not.toHaveBeenCalledWith("Invalid XML provided", expect.anything());
        expect(s3.putS3Object).toHaveBeenCalled();
    });

    it("throws an error when the subscription is inactive", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "inactive",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        });

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription is inactive"] }),
        });
        expect(dynamo.putDynamoItem).not.toHaveBeenCalled();
    });

    it("should process a valid heartbeat notification and update dynamodb with heartbeat details", async () => {
        mockEvent.body = mockHeartbeatNotification;

        const expectedSubscription: CancellationsSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-03-11T15:20:02.093Z",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "live",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({ statusCode: 200, body: "" });
        expect(dynamo.putDynamoItem).toHaveBeenCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
            "test-dynamodb",
            expectedSubscription.PK,
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("throws an error if when processing a heartbeat notification the subscription does not exist in dynamodb", async () => {
        getDynamoItemSpy.mockResolvedValue(null);
        mockEvent.body = mockHeartbeatNotification;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });
        expect(dynamo.putDynamoItem).not.toHaveBeenCalled();
    });

    it.each([[undefined], ["invalid-key"]])("returns a 401 when an invalid api key is supplied", async (key) => {
        mockEvent.queryStringParameters = {
            apiKey: key,
        };

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 401,
            body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
    });

    it.each([
        testSiriWithNoPtSituationElement,
        testSiriWithSelfClosingPtSituationElement,
        testSiriWithEmptyPtSituationElement,
    ])(
        "should return a 200 but not add data to S3 if cancellations data with no PtSituationElements is received",
        async (input) => {
            mockEvent.body = input;
            await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({ statusCode: 200, body: "" });

            expect(s3.putS3Object).not.toHaveBeenCalledOnce();
            expect(dynamo.putDynamoItem).not.toHaveBeenCalledOnce();
        },
    );
});
