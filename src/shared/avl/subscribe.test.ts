import axios, { AxiosResponse } from "axios";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as dynamo from "../dynamo";
import { AvlSubscription } from "../schema/avl-subscribe.schema";
import { InvalidXmlError } from "../validation";
import { sendSubscriptionRequestAndUpdateDynamo } from "./subscribe";
import {
    expectedRequestBody,
    expectedRequestBodyForMockProducer,
    expectedSubscriptionRequestConfig,
    mockInput,
    mockSubscriptionResponseBody,
    mockSubscriptionResponseBodyFalseStatus,
} from "./test/subscribeMockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("sendSubscriptionRequestAndUpdateDynamo", () => {
    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        putDynamoItem: vi.fn(),
    }));

    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request for a new subscription and update dynamo when valid inputs are passed", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "live",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: "2024-03-11T15:20:02.093Z",
            lastModifiedDateTime: "2024-03-11T15:20:02.093Z",
            publisherId: "mock-publisher-id",
            apiKey: "mock-api-key",
        };

        await sendSubscriptionRequestAndUpdateDynamo(
            mockInput.subscriptionId,
            mockInput.subscription,
            mockInput.username,
            mockInput.password,
            mockInput.tableName,
            mockInput.dataEndpoint,
        );

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("should process a subscription request to update an existing subscription and update dynamo when valid inputs are passed", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "live",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            lastModifiedDateTime: "2024-03-11T15:20:02.093Z",
            publisherId: "mock-publisher-id",
            apiKey: "mock-api-key",
        };

        await sendSubscriptionRequestAndUpdateDynamo(
            mockInput.subscriptionId,
            {
                ...mockInput.subscription,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
            },
            mockInput.username,
            mockInput.password,
            mockInput.tableName,
            mockInput.dataEndpoint,
        );

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("should process a subscription request for mock data producer if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        process.env.STAGE = "local";
        process.env.MOCK_PRODUCER_SUBSCRIBE_ENDPOINT = "www.local.com";

        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: "BODS_MOCK_PRODUCER",
            shortDescription: "shortDescription",
            status: "live",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            lastModifiedDateTime: "2024-03-11T15:20:02.093Z",
            publisherId: "mock-publisher-id",
            apiKey: "mock-api-key",
        };

        await sendSubscriptionRequestAndUpdateDynamo(
            mockInput.subscriptionId,
            {
                ...mockInput.subscription,
                requestorRef: "BODS_MOCK_PRODUCER",
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
            },
            mockInput.username,
            mockInput.password,
            mockInput.tableName,
            mockInput.dataEndpoint,
            false,
            "www.local.com",
        );

        expect(axiosSpy).toBeCalledWith(
            "www.local.com",
            expectedRequestBodyForMockProducer,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("should throw an error if we receive an empty response from the data producer ", async () => {
        mockedAxios.post.mockResolvedValue({
            data: null,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "error",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
            lastModifiedDateTime: null,
            apiKey: "mock-api-key",
        };

        await expect(
            sendSubscriptionRequestAndUpdateDynamo(
                mockInput.subscriptionId,
                mockInput.subscription,
                mockInput.username,
                mockInput.password,
                mockInput.tableName,
                mockInput.dataEndpoint,
            ),
        ).rejects.toThrowError("No response body received from the data producer: https://mock-data-producer.com");

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("should throw an error if it cannot parse subscription response", async () => {
        mockedAxios.post.mockResolvedValue({
            data: "<Siri/>",
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "error",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
            lastModifiedDateTime: null,
            apiKey: "mock-api-key",
        };

        await expect(
            sendSubscriptionRequestAndUpdateDynamo(
                mockInput.subscriptionId,
                mockInput.subscription,
                mockInput.username,
                mockInput.password,
                mockInput.tableName,
                mockInput.dataEndpoint,
            ),
        ).rejects.toThrowError(new InvalidXmlError("Invalid XML from subscription ID: mock-subscription-id"));

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });

    it("should throw an error if the data producers subscription response doesn't include a response status of true", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBodyFalseStatus,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "error",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
            lastModifiedDateTime: null,
            apiKey: "mock-api-key",
        };

        await expect(
            sendSubscriptionRequestAndUpdateDynamo(
                mockInput.subscriptionId,
                mockInput.subscription,
                mockInput.username,
                mockInput.password,
                mockInput.tableName,
                mockInput.dataEndpoint,
            ),
        ).rejects.toThrowError("The data producer: https://mock-data-producer.com did not return a status of true.");
        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );
    });
});
