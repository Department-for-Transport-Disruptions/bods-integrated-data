import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as s3 from "@bods-integrated-data/shared/s3";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayEvent } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { handler } from ".";
import { mockHeartbeatNotification, testSiri, testSiriWithSingleVehicleActivity } from "./testSiriVm";

describe("AVL-data-endpoint", () => {
    beforeAll(() => {
        process.env.BUCKET_NAME = "test-bucket";
        process.env.TABLE_NAME = "test-dynamodb";
    });

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        putS3Object: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        putDynamoItem: vi.fn(),
        getDynamoItem: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");

    MockDate.set("2024-03-11T15:20:02.093Z");

    afterEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    const mockSubscriptionId = "411e4495-4a57-4d2f-89d5-cf105441f321";

    it("Should add valid AVL data to S3", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        const mockEvent = {
            body: testSiri,
            pathParameters: {
                subscription_id: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        const expectedSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            description: "test-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "ACTIVE",
            url: "https://mock-data-producer.com/",
        };

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200 });
        expect(s3.putS3Object).toBeCalled();
        expect(s3.putS3Object).toBeCalledWith({
            Body: `${testSiri}`,
            Bucket: "test-bucket",
            ContentType: "application/xml",
            Key: `${mockSubscriptionId}/2024-03-11T15:20:02.093Z.xml`,
        });

        expect(dynamo.putDynamoItem).toBeCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
            "test-dynamodb",
            expectedSubscription.PK,
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("Should add valid AVL data with a single vehicle activity to S3", async () => {
        const subscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            status: "ACTIVE",
            requestorRef: null,
        };
        getDynamoItemSpy.mockResolvedValue(subscription);

        const mockEvent = {
            body: testSiriWithSingleVehicleActivity,
            pathParameters: {
                subscription_id: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200 });
        expect(s3.putS3Object).toBeCalled();
        expect(s3.putS3Object).toBeCalledWith({
            Body: `${testSiriWithSingleVehicleActivity}`,
            Bucket: "test-bucket",
            ContentType: "application/xml",
            Key: `${mockSubscriptionId}/2024-03-11T15:20:02.093Z.xml`,
        });

        expect(dynamo.putDynamoItem).toBeCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
            "test-dynamodb",
            subscription.PK,
            "SUBSCRIPTION",
            subscription,
        );
    });

    it("Should throw an error if the body is empty", async () => {
        const mockEvent = {
            body: null,
            pathParameters: {
                subscription_id: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;
        await expect(handler(mockEvent)).rejects.toThrowError("No body sent with event");
        expect(s3.putS3Object).not.toBeCalled();
    });

    it("Should throw an error if invalid XML is parsed", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            status: "ACTIVE",
            requestorRef: null,
        });

        const mockEvent = {
            body: "abc",
            pathParameters: {
                subscription_id: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 400 });
        expect(s3.putS3Object).not.toBeCalled();
    });

    it("should process a valid heartbeat notification and update dynamodb with heartbeat details", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        const mockEvent = {
            body: mockHeartbeatNotification,
            pathParameters: {
                subscription_id: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        const expectedSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-15T13:25:00+01:00",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "ACTIVE",
            url: "https://mock-data-producer.com/",
        };

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200 });
        expect(dynamo.putDynamoItem).toBeCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
            "test-dynamodb",
            expectedSubscription.PK,
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("should throw an error if when processing a heartbeat notification the subscription does not exist in dynamodb", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        const mockEvent = {
            body: mockHeartbeatNotification,
            pathParameters: {
                subscription_id: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        await expect(handler(mockEvent)).rejects.toThrowError(
            `Subscription ID: ${mockSubscriptionId} not found in DynamoDB`,
        );
        expect(dynamo.putDynamoItem).not.toBeCalled();
    });
});
