import { logger } from "@baselime/lambda-logger";
import * as avlUtils from "@bods-integrated-data/shared/avl/utils";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAvlSubscription, handler, mapApiAvlSubscriptionResponse } from "./index";

describe("avl-subscriptions", () => {
    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            error: vi.fn(),
        },
    }));

    const getAvlSubscriptionsMock = vi.spyOn(avlUtils, "getAvlSubscriptions");

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.STAGE = "local";
        process.env.TABLE_NAME = "test-dynamo-table";
    });

    it("returns a 500 when not all the env vars are set", async () => {
        process.env.TABLE_NAME = "";

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An internal error occurred.",
        });

        expect(logger.error).toHaveBeenCalledWith("Missing env vars - TABLE_NAME must be set");
    });

    it("returns a 500 when an unexpected error occurs retrieving subscriptions data", async () => {
        getAvlSubscriptionsMock.mockRejectedValueOnce(new Error());

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        });

        expect(logger.error).toHaveBeenCalledWith(
            "There was an error retrieving AVL subscription data",
            expect.any(Error),
        );
    });

    it("returns a 200 with all subscriptions data", async () => {
        getAvlSubscriptionsMock.mockResolvedValueOnce([
            {
                PK: "subscription-one",
                url: "https://www.mock-data-producer-one.com",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: "BODS_MOCK_PRODUCER",
                lastAvlDataReceivedDateTime: "2024-01-01T15:20:02.093Z",
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                publisherId: "publisher-one",
            },
            {
                PK: "subscription-two",
                url: "https://www.mock-data-producer-two.com",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "TERMINATED",
                requestorRef: "BODS_MOCK_PRODUCER",
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                publisherId: "publisher-one",
            },
        ]);

        const expectedResponse: ApiAvlSubscription[] = [
            {
                id: "subscription-one",
                publisherId: "publisher-one",
                status: "ACTIVE",
                lastAvlDataReceivedDateTime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                serviceEndDatetime: null,
            },
            {
                id: "subscription-two",
                publisherId: "publisher-one",
                status: "TERMINATED",
                lastAvlDataReceivedDateTime: null,
                heartbeatLastReceivedDateTime: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                serviceEndDatetime: null,
            },
        ];

        await expect(handler()).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify(expectedResponse),
        });
    });

    describe("mapApiAvlSubscriptionResponse", () => {
        it("maps AVL table data to API response data", () => {
            const subscription: AvlSubscription = {
                PK: "mock-PK",
                url: "mock-url",
                description: "mock-description",
                shortDescription: "mock-shortDescription",
                status: "ACTIVE",
                requestorRef: "mock-requestorRef",
                heartbeatLastReceivedDateTime: "mock-heartbeatLastReceivedDateTime",
                serviceStartDatetime: "mock-serviceStartDatetime",
                serviceEndDatetime: "mock-serviceEndDatetime",
                publisherId: "mock-publisherId",
                lastAvlDataReceivedDateTime: "mock-lastAvlDataReceivedDateTime",
            };

            const expectedApiResponse: ApiAvlSubscription = {
                id: "mock-PK",
                publisherId: "mock-publisherId",
                status: "ACTIVE",
                lastAvlDataReceivedDateTime: "mock-lastAvlDataReceivedDateTime",
                heartbeatLastReceivedDateTime: "mock-heartbeatLastReceivedDateTime",
                serviceStartDatetime: "mock-serviceStartDatetime",
                serviceEndDatetime: "mock-serviceEndDatetime",
            };

            expect(mapApiAvlSubscriptionResponse(subscription)).toEqual(expectedApiResponse);
        });

        it("maps AVL table data to API response data with null values for missing properties", () => {
            const subscription: AvlSubscription = {
                PK: "mock-PK",
                url: "mock-url",
                description: "mock-description",
                shortDescription: "mock-shortDescription",
                status: "ACTIVE",
            };

            const expectedApiResponse: ApiAvlSubscription = {
                id: "mock-PK",
                publisherId: null,
                status: "ACTIVE",
                lastAvlDataReceivedDateTime: null,
                heartbeatLastReceivedDateTime: null,
                serviceStartDatetime: null,
                serviceEndDatetime: null,
            };

            expect(mapApiAvlSubscriptionResponse(subscription)).toEqual(expectedApiResponse);
        });
    });
});
