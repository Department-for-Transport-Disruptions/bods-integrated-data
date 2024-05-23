import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent } from "aws-lambda";
import axios, { AxiosError, AxiosHeaders, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { describe, it, expect, vi, afterAll, beforeEach, beforeAll } from "vitest";
import {
    expectedRequestBody,
    expectedRequestBodyForExistingSubscription,
    expectedRequestBodyForMockProducer,
    expectedSubscriptionRequestConfig,
    mockAvlSubscribeMessage,
    mockSubscribeEvent,
    mockSubscribeEventToMockDataProducer,
    mockSubscriptionResponseBody,
    mockSubscriptionResponseBodyFalseStatus,
} from "./test/mockData";
import { handler } from "./index";

vi.mock("crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("avl-subscriber", () => {
    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.DATA_ENDPOINT = "https://www.test.com/data";
    });

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        putDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        putParameter: vi.fn(),
    }));

    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const putParameterSpy = vi.spyOn(ssm, "putParameter");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        await handler(mockSubscribeEvent);

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "5965q7gh-5428-43e2-a75c-1782a48637d5",
            "SUBSCRIPTION",
            {
                description: "description",
                requestorRef: null,
                shortDescription: "shortDescription",
                status: "ACTIVE",
                url: "https://mock-data-producer.com",
                serviceStartDatetime: "2024-03-11T15:20:02.093Z",
            },
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should throw an error if the event body from the API gateway event does not match the avlSubscribeMessage schema.", async () => {
        const invalidEvent = {
            body: JSON.stringify({
                test: "invalid event",
            }),
        } as unknown as APIGatewayEvent;

        await expect(handler(invalidEvent)).rejects.toThrowError("Invalid subscribe message from event body.");

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(putParameterSpy).not.toHaveBeenCalledTimes(2);
    });

    it("should throw an error if we do not receive a 200 response from the data producer", async () => {
        const axiosHeaders = new AxiosHeaders();
        const axiosConfig = { url: "http://localhost:3000", headers: axiosHeaders };
        mockedAxios.post.mockRejectedValue(
            new AxiosError(
                "Request failed with status code 500",
                "500",
                axiosConfig,
                {},
                {
                    data: "Request failed with status code 500",
                    status: 500,
                    config: axiosConfig,
                    statusText: "failed",
                    headers: axiosHeaders,
                },
            ),
        );

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError();

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "5965q7gh-5428-43e2-a75c-1782a48637d5",
            "SUBSCRIPTION",
            {
                description: "description",
                requestorRef: null,
                shortDescription: "shortDescription",
                status: "FAILED",
                url: "https://mock-data-producer.com",
                serviceStartDatetime: null,
            },
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should throw an error if we receive an empty response from the data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: null,
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError(
            "No response body received from the data producer: https://mock-data-producer.com",
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "5965q7gh-5428-43e2-a75c-1782a48637d5",
            "SUBSCRIPTION",
            {
                description: "description",
                requestorRef: null,
                shortDescription: "shortDescription",
                status: "FAILED",
                url: "https://mock-data-producer.com",
                serviceStartDatetime: null,
            },
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should process a subscription request for mock data producer if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        process.env.STAGE = "local";
        process.env.MOCK_PRODUCER_SUBSCRIBE_ENDPOINT = "www.local.com";

        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        await handler(mockSubscribeEventToMockDataProducer);

        expect(axiosSpy).toBeCalledWith(
            "www.local.com",
            expectedRequestBodyForMockProducer,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "5965q7gh-5428-43e2-a75c-1782a48637d5",
            "SUBSCRIPTION",
            {
                description: "description",
                requestorRef: "BODS_MOCK_PRODUCER",
                shortDescription: "shortDescription",
                status: "ACTIVE",
                url: "https://mock-data-producer.com",
                serviceStartDatetime: "2024-03-11T15:20:02.093Z",
            },
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should throw an error if it cannot parse subscription response", async () => {
        mockedAxios.post.mockResolvedValue({
            data: "<Siri/>",
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockSubscribeEventToMockDataProducer)).rejects.toThrowError(
            "Error parsing subscription response from: https://mock-data-producer.com",
        );
        expect(axiosSpy).toBeCalledWith(
            "www.local.com",
            expectedRequestBodyForMockProducer,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "5965q7gh-5428-43e2-a75c-1782a48637d5",
            "SUBSCRIPTION",
            {
                description: "description",
                requestorRef: "BODS_MOCK_PRODUCER",
                shortDescription: "shortDescription",
                status: "FAILED",
                url: "https://mock-data-producer.com",
                serviceStartDatetime: null,
            },
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should throw an error if the data producers subscription response doesn't include a response status of true", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBodyFalseStatus,
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError(
            "The data producer: https://mock-data-producer.com did not return a status of true.",
        );
        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "5965q7gh-5428-43e2-a75c-1782a48637d5",
            "SUBSCRIPTION",
            {
                description: "description",
                requestorRef: null,
                shortDescription: "shortDescription",
                status: "FAILED",
                url: "https://mock-data-producer.com",
                serviceStartDatetime: null,
            },
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/5965q7gh-5428-43e2-a75c-1782a48637d5/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should handle resubscription requests to a data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        await handler({
            ...mockSubscribeEvent,
            body: JSON.stringify({
                ...mockAvlSubscribeMessage,
                subscriptionId: "existing-subscription-id",
                requestorRef: null,
            }),
        });

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBodyForExistingSubscription,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "existing-subscription-id", "SUBSCRIPTION", {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "ACTIVE",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: "2024-03-11T15:20:02.093Z",
        });

        expect(putParameterSpy).not.toHaveBeenCalledTimes(2);
    });
});
