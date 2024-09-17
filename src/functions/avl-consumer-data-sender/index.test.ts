import * as utilFunctions from "@bods-integrated-data/shared/avl/utils";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { SQSEvent } from "aws-lambda";
import axios, { AxiosError } from "axios";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { handler } from ".";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";
const mockConsumerSubscriptionId = "mock-consumer-subscription-id";
const mockProducerSubscriptionId = "1,2,3";
const mockUserId = "mock-user-id";
const mockRandomId = "4026f53d-3548-4999-a6b6-2e6893175894";

const expectedSiriVmBody = `<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\"><ServiceDelivery><ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp><ProducerRef>DepartmentForTransport</ProducerRef><VehicleMonitoringDelivery><ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp><RequestMessageRef>4026f53d-3548-4999-a6b6-2e6893175894</RequestMessageRef><ValidUntil>2024-03-11T15:25:02.093+00:00</ValidUntil><ShortestPossibleCycle>PT5S</ShortestPossibleCycle></VehicleMonitoringDelivery></ServiceDelivery></Siri>`;

const consumerSubscription: AvlConsumerSubscription = {
    PK: "123",
    SK: mockUserId,
    subscriptionId: mockConsumerSubscriptionId,
    status: "live",
    url: "https://example.com",
    requestorRef: "123",
    heartbeatInterval: "PT30S",
    initialTerminationTime: "2024-03-11T15:20:02.093Z",
    requestTimestamp: "2024-03-11T15:20:02.093Z",
    producerSubscriptionIds: mockProducerSubscriptionId,
    heartbeatAttempts: 0,
};

describe("avl-consumer-subscriber", () => {
    const mocks = vi.hoisted(() => {
        return {
            mockDbClient: {
                destroy: vi.fn(),
            },
        };
    });

    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        queryDynamo: vi.fn(),
    }));

    vi.mock("node:crypto", () => ({
        randomUUID: () => mockRandomId,
    }));

    vi.mock("@bods-integrated-data/shared/database", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/database")>()),
        getDatabaseClient: vi.fn().mockReturnValue(mocks.mockDbClient),
    }));

    const queryDynamoSpy = vi.spyOn(dynamo, "queryDynamo");
    const getAvlDataForSiriVmSpy = vi.spyOn(utilFunctions, "getAvlDataForSiriVm");
    const mockedAxios = vi.mocked(axios, true);
    const axiosSpy = vi.spyOn(mockedAxios, "post");

    let mockEvent: SQSEvent;

    beforeAll(() => {
        MockDate.set("2024-03-11T15:20:02.093Z");
    });

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;

        mockEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        subscriptionId: mockConsumerSubscriptionId,
                        userId: mockUserId,
                    }),
                },
            ],
        } as SQSEvent;

        queryDynamoSpy.mockResolvedValue([consumerSubscription]);
        getAvlDataForSiriVmSpy.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("throws an error when the required env var AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set",
        );

        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it.each([
        { subscriptionId: "", userId: mockUserId },
        { userId: mockUserId },
        { subscriptionId: mockConsumerSubscriptionId, userId: "" },
        { userId: "" },
        {},
    ])("throws an error when the sqs message is invalid: %o", async (input) => {
        mockEvent = { Records: [{ body: JSON.stringify(input) }] } as SQSEvent;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(ZodError);

        expect(logger.error).toHaveBeenCalledWith(
            expect.anything(),
            "There was a problem with the avl-consumer-data-sender endpoint",
        );

        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it("throws an error when the subscription cannot be found", async () => {
        queryDynamoSpy.mockResolvedValue([]);

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            `Subscription ID: ${mockConsumerSubscriptionId} not found in DynamoDB`,
        );

        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it("throws an error when the subscription is not live", async () => {
        const inactiveConsumerSubscription: AvlConsumerSubscription = {
            ...consumerSubscription,
            status: "inactive",
        };

        queryDynamoSpy.mockResolvedValue([inactiveConsumerSubscription]);

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("Subscription no longer live");
        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it("sends data to the consumer", async () => {
        mockedAxios.post.mockResolvedValueOnce({ status: 200 });

        await handler(mockEvent, mockContext, mockCallback);

        expect(getAvlDataForSiriVmSpy).toHaveBeenCalledWith(
            mocks.mockDbClient,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            ["1", "2", "3"],
        );

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(axiosSpy).toHaveBeenCalledWith(consumerSubscription.url, expectedSiriVmBody, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        expect(logger.error).not.toHaveBeenCalled();
    });

    it("throws an error when the consumer endpoint returns an unsuccesful response", async () => {
        mockedAxios.post.mockRejectedValue(new AxiosError("Request failed", "500"));

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(AxiosError);

        expect(getAvlDataForSiriVmSpy).toHaveBeenCalledWith(
            mocks.mockDbClient,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            ["1", "2", "3"],
        );

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(axiosSpy).toHaveBeenCalledWith(consumerSubscription.url, expectedSiriVmBody, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        expect(logger.error).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            "Unsuccessful response from consumer subscription",
        );
        expect(logger.error).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            "There was a problem with the avl-consumer-data-sender endpoint",
        );
    });
});
