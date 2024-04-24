import * as dynamo from "@bods-integrated-data/shared/dynamo";
import axios, { AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from "vitest";
import { expectedAVLDataForSubscription, mockSubscriptionsFromDynamo } from "./test/mockData";
import { handler } from "./index";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("avl-mock-data-producer-send-data", () => {
    beforeAll(() => {
        process.env.DATA_ENDPOINT = "https://www.test-data-endpoint.com";
    });

    MockDate.set("2024-03-11T15:20:02.093Z");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should return and send no data if no subscriptions are returned from dynamo", async () => {
        process.env.STAGE = "dev";
        process.env.TABLE_NAME = "integrated-data-avl-subscription-table-dev";

        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue([]);
        await handler();
        expect(axiosSpy).not.toBeCalled();
    });

    it("should return and send no data if no mock data producers are active", async () => {
        process.env.STAGE = "dev";
        process.env.TABLE_NAME = "integrated-data-avl-subscription-table-dev";

        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue([
            {
                PK: "subscription-one",
                url: "https://www.mock-data-producer-one.com",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: "REAL_DATA_PRODUCER",
            },
            {
                PK: "subscription-one",
                url: "https://www.mock-data-producer-one.com",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "FAILED",
                requestorRef: "BODS_MOCK_PRODUCER",
            },
        ]);
        await handler();
        expect(axiosSpy).not.toBeCalled();
    });

    it("should send mock avl data with the subscriptionId in the query string parameters if the stage is local", async () => {
        process.env.STAGE = "local";
        process.env.TABLE_NAME = "integrated-data-avl-subscription-table-local";

        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue(mockSubscriptionsFromDynamo);

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler();
        expect(axiosSpy).toBeCalledTimes(2);
        expect(axiosSpy).toBeCalledWith("https://www.test-data-endpoint.com?subscription_id=subscription-one", {
            data: expectedAVLDataForSubscription("subscription-one"),
            method: "POST",
        });

        expect(axiosSpy).toBeCalledWith("https://www.test-data-endpoint.com?subscription_id=subscription-two", {
            data: expectedAVLDataForSubscription("subscription-two"),
            method: "POST",
        });
    });
    it("should send mock avl data with the subscriptionId in the path parameters if the stage not local", async () => {
        process.env.STAGE = "dev";
        process.env.TABLE_NAME = "integrated-data-avl-subscription-table-dev";

        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue(mockSubscriptionsFromDynamo);

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler();
        expect(axiosSpy).toBeCalledTimes(2);
        expect(axiosSpy).toBeCalledWith("https://www.test-data-endpoint.com/subscription-one", {
            data: expectedAVLDataForSubscription("subscription-one"),
            method: "POST",
        });

        expect(axiosSpy).toBeCalledWith("https://www.test-data-endpoint.com/subscription-two", {
            data: expectedAVLDataForSubscription("subscription-two"),
            method: "POST",
        });
    });
});
