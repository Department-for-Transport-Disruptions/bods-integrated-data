import * as unsubscribe from "@bods-integrated-data/shared/avl/unsubscribe";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as secretsManager from "@bods-integrated-data/shared/secretsManager";
import * as ssm from "@bods-integrated-data/shared/ssm";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

const mockedAxios = vi.mocked(axios, true);
describe("avl-feed-validator", () => {
    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.SUBSCRIBE_ENDPOINT = "www.avl-service.com/subscriptions";
        process.env.AVL_PRODUCER_API_KEY_ARN = "mock-key-arn";
    });

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        recursiveScan: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        getParameter: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/avl/unsubscribe", () => ({
        sendTerminateSubscriptionRequest: vi.fn(),
    }));

    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const getParameterSpy = vi.spyOn(ssm, "getParameter");
    const getSecretSpy = vi.spyOn(secretsManager, "getSecret");
    const sendTerminateSubscriptionRequestSpy = vi.spyOn(unsubscribe, "sendTerminateSubscriptionRequest");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    MockDate.set("2024-04-29T15:15:00.000Z");

    beforeEach(() => {
        vi.resetAllMocks();
        getSecretSpy.mockResolvedValue("mock-api-key");
    });

    it("should do nothing if no subscriptions are found to validate", async () => {
        recursiveScanSpy.mockResolvedValue([]);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(getParameterSpy).not.toBeCalledTimes(2);
        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });

    it("should do nothing if all subscriptions have valid heartbeat notifications associated with them", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:14:30.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:14:30.000Z",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        recursiveScanSpy.mockResolvedValue(avlSubscriptions);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(getParameterSpy).not.toBeCalledTimes(2);
        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });

    it("should update subscriptions table if subscription has valid heartbeat notification associated with it but the status is not live", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "error",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:14:30.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
        ];

        recursiveScanSpy.mockResolvedValue(avlSubscriptions);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(getParameterSpy).not.toHaveBeenCalledTimes(2);
        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toHaveBeenCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:14:30.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "live",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id-1",
            apiKey: "mock-api-key-1",
        });

        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });

    it("should resubscribe to the data producer if we have not received a heartbeat notification for that subscription in the last 90 seconds", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        recursiveScanSpy.mockResolvedValue(avlSubscriptions);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            "mock-subscription-id-1",
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            false,
        );

        expect(getParameterSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenCalledWith(
            "www.avl-service.com/subscriptions",
            {
                dataProducerEndpoint: "https://mock-data-producer.com/",
                description: "test-description",
                password: "test-password",
                requestorRef: null,
                shortDescription: "test-short-description",
                subscriptionId: "mock-subscription-id-1",
                username: "test-password",
                publisherId: "test-publisher-id-1",
            },
            {
                headers: {
                    "x-api-key": "mock-api-key",
                },
            },
        );
        expect(putDynamoItemSpy).toHaveBeenCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "error",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id-1",
            apiKey: "mock-api-key-1",
        });
    });

    it("should throw an error if we resubscribe to a data producer and a username or password is not found for that subscription", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        recursiveScanSpy.mockResolvedValue(avlSubscriptions);

        getParameterSpy.mockResolvedValue({ Parameter: undefined });
        getParameterSpy.mockResolvedValue({ Parameter: undefined });

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrowError(
            "Cannot resubscribe to data producer as username or password is missing for subscription ID: mock-subscription-id-1.",
        );

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            "mock-subscription-id-1",
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            false,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "error",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id-1",
            apiKey: "mock-api-key-1",
        });
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if we do not receive a 200 response from the /subscriptions endpoint", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        recursiveScanSpy.mockResolvedValue(avlSubscriptions);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        mockedAxios.post.mockRejectedValue({
            message: "Request failed with status code 500",
            code: "500",
            isAxiosError: true,
            toJSON: () => {},
            name: "AxiosError",
        } as AxiosError);

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrowError(
            "Request failed with status code 500",
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "error",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id-1",
            apiKey: "mock-api-key-1",
        });
        expect(axiosSpy).toHaveBeenCalledOnce();
        expect(axiosSpy).toHaveBeenCalledOnce();
    });

    it("should resubscribe to the data producer even if the attempt to unsubscribe has failed", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        recursiveScanSpy.mockResolvedValue(avlSubscriptions);

        sendTerminateSubscriptionRequestSpy.mockRejectedValue({});

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler(mockEvent, mockContext, mockCallback);

        expect(getParameterSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenCalledWith(
            "www.avl-service.com/subscriptions",
            {
                dataProducerEndpoint: "https://mock-data-producer.com/",
                description: "test-description",
                password: "test-password",
                requestorRef: null,
                shortDescription: "test-short-description",
                subscriptionId: "mock-subscription-id-1",
                username: "test-password",
                publisherId: "test-publisher-id-1",
            },
            {
                headers: {
                    "x-api-key": "mock-api-key",
                },
            },
        );
        expect(putDynamoItemSpy).toHaveBeenCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "error",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id-1",
            apiKey: "mock-api-key-1",
        });
    });
});
