import { logger } from "@baselime/lambda-logger";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayProxyEvent } from "aws-lambda";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import {
    expectedRequestBody,
    expectedSubscriptionRequestConfig,
    mockFailedSubscriptionResponseBody,
    mockSubscriptionInvalidBody,
    mockSubscriptionResponseBody,
    mockUnsubscribeEvent,
} from "./test/mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("avl-unsubscriber", () => {
    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        deleteParameters: vi.fn(),
        getParameter: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const getParameterSpy = vi.spyOn(ssm, "getParameter");
    const deleteParametersSpy = vi.spyOn(ssm, "deleteParameters");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including deleting auth creds from parameter store and subscription details to DynamoDB", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        await handler(mockUnsubscribeEvent);

        expect(axiosSpy).toHaveBeenCalledWith(
            "https://mock-data-producer.com/",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toHaveBeenCalledWith("test-dynamo-table", "mock-subscription-id", "SUBSCRIPTION", {
            PK: "mock-subscription-id",
            description: "test-description",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "INACTIVE",
            url: "https://mock-data-producer.com/",
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            serviceEndDatetime: "2024-03-11T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        expect(deleteParametersSpy).toHaveBeenCalledOnce();
        expect(deleteParametersSpy).toHaveBeenCalledWith([
            "/subscription/mock-subscription-id/username",
            "/subscription/mock-subscription-id/password",
        ]);
    });

    it.each([
        [undefined, "subscriptionId is required"],
        [null, "subscriptionId must be a string"],
        [1, "subscriptionId must be a string"],
        [{}, "subscriptionId must be a string"],
        ["", "subscriptionId must be 1-256 characters"],
        ["1".repeat(257), "subscriptionId must be 1-256 characters"],
    ])(
        "Throws an error when the subscription ID fails validation (test: %o)",
        async (subscriptionId, expectedErrorMessage) => {
            const mockEvent = {
                pathParameters: {
                    subscriptionId,
                },
                body: null,
            } as unknown as APIGatewayProxyEvent;

            const response = await handler(mockEvent);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: [expectedErrorMessage] }),
            });
            expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
            expect(putDynamoItemSpy).not.toHaveBeenCalled();
            expect(deleteParametersSpy).not.toHaveBeenCalled();
        },
    );

    it("should throw an error if subscription id not found in dynamo.", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({ errors: ["Subscription not found"] }),
        });
        expect(logger.error).toHaveBeenCalledWith("Subscription not found", expect.any(Error));

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if we do not receive a 200 response from the data producer", async () => {
        mockedAxios.post.mockRejectedValue({
            message: "Request failed with status code 500",
            code: "500",
            isAxiosError: true,
            toJSON: () => {},
            name: "AxiosError",
        } as AxiosError);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if we receive an empty response from the data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: null,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if invalid xml received from the data producer's response", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionInvalidBody,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid SIRI-VM XML provided by the data producer"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith(
            "Invalid SIRI-VM XML provided by the data producer",
            expect.anything(),
        );

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if data producer does not return a status of true", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockFailedSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if no auth creds are found for a subscription", async () => {
        getParameterSpy.mockResolvedValue({ Parameter: undefined });
        getParameterSpy.mockResolvedValue({ Parameter: undefined });

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            publisherId: "test-publisher-id",
        });

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("Throws an error when the required env vars are missing", async () => {
        process.env.TABLE_NAME = "";

        const response = await handler(mockUnsubscribeEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the AVL unsubscribe endpoint",
            expect.any(Error),
        );
        expect(putDynamoItemSpy).not.toHaveBeenCalled();
        expect(deleteParametersSpy).not.toHaveBeenCalled();
    });
});
