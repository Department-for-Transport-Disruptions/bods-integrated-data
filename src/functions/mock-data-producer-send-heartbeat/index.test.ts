import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import axios from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import { expectedHeartbeatNotification, mockSubscriptionsFromDynamo } from "./test/mockData";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);
describe("mock-data-producer-send-data", () => {
    MockDate.set("2024-03-11T15:20:02.093Z");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    beforeEach(() => {
        process.env.STAGE = "dev";
        process.env.AVL_DATA_ENDPOINT = "https://www.avl-data-endpoint.com";
        process.env.AVL_TABLE_NAME = "integrated-data-avl-subscription-table-dev";
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should return and send no data if no subscriptions are returned from dynamo", async () => {
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue([]);
        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).not.toBeCalled();
    });

    it("should return and send no data if no mock data producers are active", async () => {
        const avlSubscriptions: AvlSubscription[] = [
            {
                PK: "subscription-one",
                url: "https://www.mock-data-producer-one.com",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "live",
                requestorRef: "REAL_DATA_PRODUCER",
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                publisherId: "test-publisher-id-1",
                apiKey: "mock-api-key-1",
            },
            {
                PK: "subscription-one",
                url: "https://www.mock-data-producer-one.com",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "error",
                requestorRef: "BODS_MOCK_PRODUCER",
                publisherId: "test-publisher-id-2",
                apiKey: "mock-api-key-2",
            },
        ];

        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue(avlSubscriptions);
        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).not.toBeCalled();
    });

    it("should send mock avl data with the subscriptionId in the query string parameters if the stage is local", async () => {
        process.env.STAGE = "local";
        process.env.AVL_TABLE_NAME = "integrated-data-avl-subscription-table-local";

        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue(mockSubscriptionsFromDynamo);

        axiosSpy.mockResolvedValue({
            status: 200,
        } as unknown as Response);

        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenNthCalledWith(
            1,
            "https://www.avl-data-endpoint.com?subscriptionId=subscription-one&apiKey=mock-api-key-1",
            expectedHeartbeatNotification("subscription-one"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );

        expect(axiosSpy).toHaveBeenNthCalledWith(
            2,
            "https://www.avl-data-endpoint.com?subscriptionId=subscription-two&apiKey=mock-api-key-2",
            expectedHeartbeatNotification("subscription-two"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );
    });
    it("should send mock avl data with the subscriptionId in the path parameters if the stage not local", async () => {
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue(mockSubscriptionsFromDynamo);

        axiosSpy.mockResolvedValue({
            status: 200,
        } as unknown as Response);

        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenNthCalledWith(
            1,
            "https://www.avl-data-endpoint.com/subscription-one?apiKey=mock-api-key-1",
            expectedHeartbeatNotification("subscription-one"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );

        expect(axiosSpy).toHaveBeenNthCalledWith(
            2,
            "https://www.avl-data-endpoint.com/subscription-two?apiKey=mock-api-key-2",
            expectedHeartbeatNotification("subscription-two"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );
    });
});
