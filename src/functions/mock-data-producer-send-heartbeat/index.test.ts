import * as avlUtils from "@bods-integrated-data/shared/avl/utils";
import * as cancellationsUtils from "@bods-integrated-data/shared/cancellations/utils";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { CancellationsSubscription } from "@bods-integrated-data/shared/schema";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import axios from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

const mockAvlSubscriptions: AvlSubscription[] = [
    {
        PK: "subscription-avl-1",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        requestorRef: "BODS_MOCK_PRODUCER",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        publisherId: "test-publisher-id-1",
        apiKey: "mock-api-key-1",
    },
    {
        PK: "subscription-avl-2",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        publisherId: "test-publisher-id-2",
        apiKey: "mock-api-key-2",
    },
    {
        PK: "subscription-avl-3",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "inactive",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-3",
        apiKey: "mock-api-key-3",
    },
    {
        PK: "subscription-avl-4",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "error",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-4",
        apiKey: "mock-api-key-4",
    },
];

const mockCancellationsSubscriptions: CancellationsSubscription[] = [
    {
        PK: "subscription-cancellations-1",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        requestorRef: "BODS_MOCK_PRODUCER",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        publisherId: "test-publisher-id-1",
        apiKey: "mock-api-key-1",
    },
    {
        PK: "subscription-cancellations-2",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        publisherId: "test-publisher-id-2",
        apiKey: "mock-api-key-2",
    },
    {
        PK: "subscription-cancellations-3",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "inactive",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-3",
        apiKey: "mock-api-key-3",
    },
    {
        PK: "subscription-cancellations-4",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "error",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-4",
        apiKey: "mock-api-key-4",
    },
];

const expectedHeartbeatNotification = (subscriptionId: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0">
    <HeartbeatNotification>
        <RequestTimestamp>2024-03-11T15:20:02.093+00:00</RequestTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <Status>true</Status>
        <ServiceStartedTime>2024-03-11T15:20:02.093+00:00</ServiceStartedTime>
    </HeartbeatNotification>
</Siri>`;

describe("mock-data-producer-send-data", () => {
    MockDate.set("2024-03-11T15:20:02.093Z");

    vi.mock("axios");
    const mockedAxios = vi.mocked(axios, true);
    const axiosSpy = vi.spyOn(mockedAxios, "post");

    beforeEach(() => {
        process.env.STAGE = "dev";
        process.env.AVL_DATA_ENDPOINT = "https://www.avl-data-endpoint.com";
        process.env.AVL_TABLE_NAME = "integrated-data-avl-subscription-table-dev";
        process.env.CANCELLATIONS_DATA_ENDPOINT = "https://www.cancellations-data-endpoint.com";
        process.env.CANCELLATIONS_TABLE_NAME = "integrated-data-cancellations-subscription-table-dev";

        vi.resetAllMocks();
        vi.spyOn(avlUtils, "getAvlSubscriptions").mockResolvedValue(mockAvlSubscriptions);
        vi.spyOn(cancellationsUtils, "getCancellationsSubscriptions").mockResolvedValue(mockCancellationsSubscriptions);
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should return and send no data if no subscriptions are returned from dynamo", async () => {
        vi.spyOn(avlUtils, "getAvlSubscriptions").mockResolvedValue([]);
        vi.spyOn(cancellationsUtils, "getCancellationsSubscriptions").mockResolvedValue([]);
        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).not.toBeCalled();
    });

    it("should return and send no data if no mock data producers are active", async () => {
        vi.spyOn(avlUtils, "getAvlSubscriptions").mockResolvedValue(mockAvlSubscriptions.slice(1));
        vi.spyOn(cancellationsUtils, "getCancellationsSubscriptions").mockResolvedValue(
            mockCancellationsSubscriptions.slice(1),
        );
        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).not.toBeCalled();
    });

    it("should send mock data with the subscriptionId in the query string parameters if the stage is local", async () => {
        process.env.STAGE = "local";
        process.env.AVL_TABLE_NAME = "integrated-data-avl-subscription-table-local";

        axiosSpy.mockResolvedValue({
            status: 200,
        } as unknown as Response);

        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenNthCalledWith(
            1,
            "https://www.avl-data-endpoint.com?subscriptionId=subscription-avl-1&apiKey=mock-api-key-1",
            expectedHeartbeatNotification("subscription-avl-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );

        expect(axiosSpy).toHaveBeenNthCalledWith(
            2,
            "https://www.cancellations-data-endpoint.com?subscriptionId=subscription-cancellations-1&apiKey=mock-api-key-1",
            expectedHeartbeatNotification("subscription-cancellations-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );
    });

    it("should send mock data with the subscriptionId in the path parameters if the stage not local", async () => {
        axiosSpy.mockResolvedValue({
            status: 200,
        } as unknown as Response);

        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenNthCalledWith(
            1,
            "https://www.avl-data-endpoint.com/subscription-avl-1?apiKey=mock-api-key-1",
            expectedHeartbeatNotification("subscription-avl-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );

        expect(axiosSpy).toHaveBeenNthCalledWith(
            2,
            "https://www.cancellations-data-endpoint.com/subscription-cancellations-1?apiKey=mock-api-key-1",
            expectedHeartbeatNotification("subscription-cancellations-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );
    });
});
