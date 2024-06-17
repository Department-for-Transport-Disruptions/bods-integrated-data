import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent } from "aws-lambda";
import axios, { AxiosError, AxiosHeaders, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import {
    expectedRequestBody,
    expectedRequestBodyForMockProducer,
    expectedSubscriptionRequestConfig,
    mockSubscribeEvent,
    mockSubscribeEventToMockDataProducer,
    mockSubscriptionResponseBody,
    mockSubscriptionResponseBodyFalseStatus,
} from "./test/mockData";

vi.mock("node:crypto", () => ({
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
        getDynamoItem: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        putParameter: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const putParameterSpy = vi.spyOn(ssm, "putParameter");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
        getDynamoItemSpy.mockResolvedValue(null);
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "LIVE",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: "2024-03-11T15:20:02.093Z",
            publisherId: "mock-publisher-id",
        };

        await handler(mockSubscribeEvent);

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

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it.each([
        [
            {
                test: "invalid event",
            },
        ],
        [
            {
                dataProducerEndpoint: "test-dataProducerEndpoint",
                description: "test-description",
                shortDescription: "test-shortDescription",
                username: "test-username",
                password: "test-password",
                requestorRef: "test-requestorRef",
            },
        ],
    ])(
        "should throw an error if the event body from the API gateway event does not match the avlSubscribeMessage schema.",
        async (input) => {
            const invalidEvent = { body: JSON.stringify(input) } as unknown as APIGatewayEvent;

            await expect(handler(invalidEvent)).rejects.toThrowError("Invalid subscribe message from event body.");

            expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
            expect(putParameterSpy).not.toHaveBeenCalledTimes(2);
        },
    );

    it("should throw an error if we do not receive a 201 response from the data producer", async () => {
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

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "FAILED",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError();

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should throw an error if we receive an empty response from the data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: null,
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: null,
            shortDescription: "shortDescription",
            status: "FAILED",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError(
            "No response body received from the data producer: https://mock-data-producer.com",
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith(
            "test-dynamo-table",
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("returns a 409 when attempting to subscribe with a subscription ID that is already active", async () => {
        getDynamoItemSpy.mockResolvedValue({
            status: "LIVE",
        });

        await expect(handler(mockSubscribeEvent)).resolves.toEqual({
            statusCode: 409,
            body: "Subscription ID already active",
        });

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(putParameterSpy).not.toHaveBeenCalledTimes(2);
    });

    getDynamoItemSpy.mockResolvedValue({
        PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
        url: "https://mock-data-producer.com/",
        description: "test-description",
        shortDescription: "test-short-description",
        lastAvlDataReceivedDateTime: "2024-03-11T15:20:02.093Z",
        status: "LIVE",
        requestorRef: null,
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
            status: "LIVE",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: "2024-03-11T15:20:02.093Z",
            publisherId: "mock-publisher-id",
        };

        await handler(mockSubscribeEventToMockDataProducer);

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

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });

    it("should throw an error if it cannot parse subscription response", async () => {
        mockedAxios.post.mockResolvedValue({
            data: "<Siri/>",
            status: 201,
        } as AxiosResponse);

        const expectedSubscription: Omit<AvlSubscription, "PK"> = {
            description: "description",
            requestorRef: "BODS_MOCK_PRODUCER",
            shortDescription: "shortDescription",
            status: "FAILED",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

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
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/password",
            "dummy-password",
            "SecureString",
            true,
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
            status: "FAILED",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

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
            "mock-subscription-id",
            "SUBSCRIPTION",
            expectedSubscription,
        );

        expect(putParameterSpy).toHaveBeenCalledTimes(2);
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/username",
            "test-user",
            "SecureString",
            true,
        );
        expect(putParameterSpy).toBeCalledWith(
            "/subscription/mock-subscription-id/password",
            "dummy-password",
            "SecureString",
            true,
        );
    });
});
