import { logger } from "@baselime/lambda-logger";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as s3 from "@bods-integrated-data/shared/s3";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayProxyEvent } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {} from "zod";
import { handler } from ".";
import { mockHeartbeatNotification, testSiri, testSiriWithSingleVehicleActivity } from "./testSiriVm";

describe("AVL-data-endpoint", () => {
    beforeEach(() => {
        process.env.BUCKET_NAME = "test-bucket";
        process.env.TABLE_NAME = "test-dynamodb";
    });

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
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
            status: "LIVE",
            requestorRef: null,
        });

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: testSiri,
        } as unknown as APIGatewayProxyEvent;

        const expectedSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            description: "test-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "LIVE",
            url: "https://mock-data-producer.com/",
        };

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200, body: "" });
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
            lastAvlDataReceivedDateTime: "2024-03-11T00:00:00.000Z",
            status: "LIVE",
            requestorRef: null,
        };
        getDynamoItemSpy.mockResolvedValue(subscription);

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: testSiriWithSingleVehicleActivity,
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200, body: "" });
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
            { ...subscription, lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z" },
        );
    });

    it("Throws an error when the required env vars are missing", async () => {
        process.env.BUCKET_NAME = "";
        process.env.TABLE_NAME = "";

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: testSiriWithSingleVehicleActivity,
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });
        expect(logger.error).toHaveBeenCalledWith("There was a problem with the Data endpoint", expect.any(Error));
        expect(s3.putS3Object).not.toBeCalled();
    });

    it.each([
        [undefined, "subscriptionId is required"],
        [null, "subscriptionId must be a string"],
        [1, "subscriptionId must be a string"],
        [{}, "subscriptionId must be a string"],
        ["", "subscriptionId must be 1-256 characters"],
        ["1".repeat(257), "subscriptionId must be 1-256 characters"],
    ])(
        "Throws an error when the subscription ID fails validation (test: %o)",
        async (subscriptionId, expectedErrorMessage) => {
            const mockEvent = {
                pathParameters: {
                    subscriptionId,
                },
                body: null,
            } as unknown as APIGatewayProxyEvent;

            const response = await handler(mockEvent);
            const responseBody = JSON.parse(response.body);

            expect(response.statusCode).toEqual(400);
            expect(responseBody).toEqual({ errors: [expectedErrorMessage] });
            expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
            expect(s3.putS3Object).not.toBeCalled();
        },
    );

    it.each([
        [undefined, "Body is required"],
        [null, "Body must be a string"],
        [1, "Body must be a string"],
        [{}, "Body must be a string"],
    ])("Throws an error when the body fails validation (test %#)", async (body, expectedErrorMessage) => {
        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body,
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(400);
        expect(responseBody).toEqual({ errors: [expectedErrorMessage] });
        expect(logger.warn).toHaveBeenCalledWith("Invalid request", [expect.anything()]);
        expect(s3.putS3Object).not.toBeCalled();
    });

    it("Throw an error when invalid SIRI-VM is provided", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
            status: "LIVE",
            requestorRef: null,
        });

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: "abc",
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(400);
        expect(responseBody).toEqual({ errors: ["Body must be valid SIRI-VM XML"] });
        expect(logger.warn).toHaveBeenCalledWith("Invalid SIRI-VM XML provided", expect.anything());
        expect(s3.putS3Object).not.toBeCalled();
    });

    it("Throws an error when the subscription is not live", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "INACTIVE",
            requestorRef: null,
        });

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: testSiriWithSingleVehicleActivity,
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        // expect(response.statusCode).toEqual(404);
        expect(logger.error).toHaveBeenCalledWith(
            `Subscription: ${mockSubscriptionId} is not LIVE, data will not be processed...`,
        );
        expect(responseBody).toEqual({ errors: ["Subscription is not live"] });
        expect(dynamo.putDynamoItem).not.toBeCalled();
    });

    it("should process a valid heartbeat notification and update dynamodb with heartbeat details", async () => {
        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
        });

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: mockHeartbeatNotification,
        } as unknown as APIGatewayProxyEvent;

        const expectedSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-15T13:25:00+01:00",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "LIVE",
            url: "https://mock-data-producer.com/",
        };

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200, body: "" });
        expect(dynamo.putDynamoItem).toBeCalledWith<Parameters<typeof dynamo.putDynamoItem>>(
            "test-dynamodb",
            expectedSubscription.PK,
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("Throws an error if when processing a heartbeat notification the subscription does not exist in dynamodb", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        const mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            body: mockHeartbeatNotification,
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(404);
        expect(logger.error).toHaveBeenCalledWith("Subscription not found", expect.any(Error));
        expect(responseBody).toEqual({ errors: ["Subscription not found"] });
        expect(dynamo.putDynamoItem).not.toBeCalled();
    });
});
3;
