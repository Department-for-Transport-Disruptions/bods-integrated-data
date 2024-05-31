import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
    });

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
            status: "ACTIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        });

        await handler(mockUnsubscribeEvent);

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com/",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id", "SUBSCRIPTION", {
            PK: "mock-subscription-id",
            description: "test-description",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "TERMINATED",
            url: "https://mock-data-producer.com/",
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            serviceEndDatetime: "2024-03-11T15:20:02.093Z",
        });

        expect(deleteParametersSpy).toHaveBeenCalledOnce();
        expect(deleteParametersSpy).toBeCalledWith([
            "/subscription/mock-subscription-id/username",
            "/subscription/mock-subscription-id/password",
        ]);
    });

    it("should throw an error if subscription id not found in dynamo.", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            `Subscription ID: mock-subscription-id not found in DynamoDB`,
        );

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
            status: "ACTIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError("Request failed with status code 500");

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
            status: "ACTIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "No response body received from the data producer - subscription ID: mock-subscription-id",
        );

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
            status: "ACTIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "Error parsing the terminate subscription response from the data producer",
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
            status: "ACTIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "The data producer did not return a status of true - subscription ID: mock-subscription-id",
        );

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
            status: "ACTIVE",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError("Missing auth credentials for subscription");

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });
});
