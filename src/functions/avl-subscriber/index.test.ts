import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayProxyEvent } from "aws-lambda";
import axios, { AxiosError, AxiosHeaders, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.DATA_ENDPOINT = "https://www.test.com/data";
        process.env.STAGE = "";
        process.env.MOCK_PRODUCER_SUBSCRIBE_ENDPOINT = "";
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
        [null, ["Body must be an object with required properties"]],
        ["", ["Body must be an object with required properties"]],
        [
            {},
            [
                "dataProducerEndpoint is required",
                "description is required",
                "shortDescription is required",
                "username is required",
                "password is required",
                "subscriptionId is required",
                "publisherId is required",
            ],
        ],
        [
            {
                test: "invalid event",
            },
            [
                "dataProducerEndpoint is required",
                "description is required",
                "shortDescription is required",
                "username is required",
                "password is required",
                "subscriptionId is required",
                "publisherId is required",
            ],
        ],
        [
            {
                dataProducerEndpoint: null,
                description: null,
                shortDescription: null,
                username: null,
                password: null,
                requestorRef: null,
                subscriptionId: null,
                publisherId: null,
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
                "requestorRef must be a string",
                "subscriptionId must be a string",
                "publisherId must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: 1,
                description: 1,
                shortDescription: 1,
                username: 1,
                password: 1,
                requestorRef: 1,
                subscriptionId: 1,
                publisherId: 1,
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
                "requestorRef must be a string",
                "subscriptionId must be a string",
                "publisherId must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: {},
                description: {},
                shortDescription: {},
                username: {},
                password: {},
                requestorRef: {},
                subscriptionId: {},
                publisherId: {},
            },
            [
                "dataProducerEndpoint must be a string",
                "description must be a string",
                "shortDescription must be a string",
                "username must be a string",
                "password must be a string",
                "requestorRef must be a string",
                "subscriptionId must be a string",
                "publisherId must be a string",
            ],
        ],
        [
            {
                dataProducerEndpoint: "https://example.com",
                description: "",
                shortDescription: "",
                username: "",
                password: "",
                requestorRef: "",
                subscriptionId: "",
                publisherId: "",
            },
            [
                "description must be 1-256 characters",
                "shortDescription must be 1-256 characters",
                "username must be 1-256 characters",
                "password must be 1-256 characters",
                "requestorRef must be 1-256 characters",
                "subscriptionId must be 1-256 characters",
                "publisherId must be 1-256 characters",
            ],
        ],
        [
            {
                dataProducerEndpoint: "asdf",
                description: "1".repeat(257),
                shortDescription: "1".repeat(257),
                username: "1".repeat(257),
                password: "1".repeat(257),
                requestorRef: "1".repeat(257),
                subscriptionId: "1".repeat(257),
                publisherId: "1".repeat(257),
            },
            [
                "dataProducerEndpoint must be a URL",
                "description must be 1-256 characters",
                "shortDescription must be 1-256 characters",
                "username must be 1-256 characters",
                "password must be 1-256 characters",
                "requestorRef must be 1-256 characters",
                "subscriptionId must be 1-256 characters",
                "publisherId must be 1-256 characters",
            ],
        ],
    ])(
        "should throw an error if the event body from the API gateway event does not match the avlSubscribeMessage schema.",
        async (input, expectedErrorMessages) => {
            const invalidEvent = { body: JSON.stringify(input) } as unknown as APIGatewayProxyEvent;

            const response = await handler(invalidEvent);
            const responseBody = JSON.parse(response.body);

            expect(response.statusCode).toEqual(400);
            expect(responseBody).toEqual({ errors: expectedErrorMessages });

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
            status: "ERROR",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

        const response = await handler(mockSubscribeEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });

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
            status: "ERROR",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

        const response = await handler(mockSubscribeEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });

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

        const response = await handler(mockSubscribeEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(409);
        expect(responseBody).toEqual({ errors: ["Subscription ID already active"] });

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(putParameterSpy).not.toHaveBeenCalledTimes(2);
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
            status: "ERROR",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

        const response = await handler(mockSubscribeEventToMockDataProducer);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(400);
        expect(responseBody).toEqual({ errors: ["Invalid SIRI-VM XML provided by the data producer"] });

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
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
            status: "ERROR",
            url: "https://mock-data-producer.com",
            serviceStartDatetime: null,
            publisherId: "mock-publisher-id",
        };

        const response = await handler(mockSubscribeEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });

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

    it("throws an error when the required env vars are missing", async () => {
        process.env.DATA_ENDPOINT = "";
        process.env.TABLE_NAME = "";

        const response = await handler(mockSubscribeEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });
    });

    it("throws an error when the stage is local and the mock data producer env var is missing", async () => {
        process.env.STAGE = "local";

        const response = await handler(mockSubscribeEvent);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).toEqual(500);
        expect(responseBody).toEqual({ errors: ["An unexpected error occurred"] });
    });
});
