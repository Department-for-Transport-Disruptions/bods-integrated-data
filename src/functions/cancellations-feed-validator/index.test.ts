import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { CancellationsSubscription } from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import * as secretsManager from "@bods-integrated-data/shared/secretsManager";
import * as ssm from "@bods-integrated-data/shared/ssm";
import * as unsubscribe from "@bods-integrated-data/shared/unsubscribe";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

const mockedAxios = vi.mocked(axios, true);
describe("cancellations-feed-validator", () => {
    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.SUBSCRIBE_ENDPOINT = "www.cancellations-service.com/subscriptions";
        process.env.CANCELLATIONS_PRODUCER_API_KEY_ARN = "mock-key-arn";
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

    vi.mock("@bods-integrated-data/shared/unsubscribe", () => ({
        sendTerminateSubscriptionRequest: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
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
        const cancellationsSubscriptions: CancellationsSubscription[] = [
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

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(getParameterSpy).not.toBeCalledTimes(2);
        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });

    it("should update subscriptions table if subscription has valid heartbeat notification associated with it but the status is not live", async () => {
        const cancellationsSubscriptions: CancellationsSubscription[] = [
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

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

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

    it("should do nothing if subscriptions have no heartbeat data but have received cancellations data", async () => {
        const cancellationsSubscriptions: CancellationsSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: null,
                lastCancellationsDataReceivedDateTime: "2024-04-29T15:14:30.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
        ];

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).not.toHaveBeenCalledOnce();
        expect(getParameterSpy).not.toBeCalledTimes(2);
        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });

    it("should resubscribe to the data producer if we have not received a heartbeat notification for that subscription in the last 90 seconds", async () => {
        const cancellationsSubscriptions: CancellationsSubscription[] = [
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
                lastCancellationsDataReceivedDateTime: "2024-04-29T15:00:00.000Z",
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
                lastCancellationsDataReceivedDateTime: "2024-04-29T15:20:00.000Z",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler(mockEvent, mockContext, mockCallback);

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            "cancellations",
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
                lastCancellationsDataReceivedDateTime: "2024-04-29T15:00:00.000Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            false,
        );

        expect(getParameterSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenCalledWith(
            "www.cancellations-service.com/subscriptions",
            {
                dataProducerEndpoint: "https://mock-data-producer.com/",
                description: "test-description",
                operatorRefs: null,
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
            lastCancellationsDataReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "error",
            url: "https://mock-data-producer.com/",
            publisherId: "test-publisher-id-1",
            apiKey: "mock-api-key-1",
        });
    });

    it("should set status as error if we resubscribe to a data producer and a username or password is not found for that subscription", async () => {
        const cancellationsSubscriptions: CancellationsSubscription[] = [
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

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

        getParameterSpy.mockResolvedValue({ Parameter: undefined });
        getParameterSpy.mockResolvedValue({ Parameter: undefined });

        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.error).toHaveBeenCalledWith(
            Error(
                "Cannot resubscribe to data producer as username or password is missing for subscription ID: mock-subscription-id-1",
            ),

            "There was an error when resubscribing to the data producer",
        );

        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledOnce();
        expect(sendTerminateSubscriptionRequestSpy).toHaveBeenCalledWith(
            "cancellations",
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

    it("should set status as error if we do not receive a 200 response from the /subscriptions endpoint", async () => {
        const cancellationsSubscriptions: CancellationsSubscription[] = [
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

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        mockedAxios.post.mockRejectedValue(new AxiosError("Error resubscribing", "500"));

        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Object),
            "There was an error when resubscribing to the data producer - subscriptionId: mock-subscription-id-1",
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
        const cancellationsSubscriptions: CancellationsSubscription[] = [
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
                operatorRefs: ["TEST"],
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

        recursiveScanSpy.mockResolvedValue(cancellationsSubscriptions);

        sendTerminateSubscriptionRequestSpy.mockRejectedValue({});

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler(mockEvent, mockContext, mockCallback);

        expect(getParameterSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenCalledWith(
            "www.cancellations-service.com/subscriptions",
            {
                dataProducerEndpoint: "https://mock-data-producer.com/",
                description: "test-description",
                operatorRefs: ["TEST"],
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
            operatorRefs: ["TEST"],
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
