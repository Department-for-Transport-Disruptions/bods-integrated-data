import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import * as MockDate from "mockdate";
import { describe, it, expect, vi, afterAll, beforeEach, beforeAll } from "vitest";
import {
    expectedSubscriptionRequest,
    mockFailedSubscriptionResponseBody,
    mockSubscriptionInvalidBody,
    mockSubscriptionResponseBody,
    mockUnsubscribeEvent,
} from "./test/mockData";
import { handler } from "./index";

vi.mock("crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

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
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const deleteParametersSpy = vi.spyOn(ssm, "deleteParameters");

    const fetchSpy = vi.spyOn(global, "fetch");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including deleting auth creds from parameter store and subscription details to DynamoDB", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionResponseBody),
            status: 200,
            ok: true,
        } as unknown as Response);

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        await handler(mockUnsubscribeEvent);

        expect(fetch).toBeCalledWith("https://mock-data-producer.com/", expectedSubscriptionRequest);

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id", "SUBSCRIPTION", {
            PK: "mock-subscription-id",
            description: "test-description",
            requestorRef: null,
            shortDescription: "test-short-description",
            status: "TERMINATED",
            url: "https://mock-data-producer.com/",
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
        fetchSpy.mockResolvedValue({
            text: "failed",
            status: 500,
            ok: false,
        } as unknown as Response);

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "There was an error when sending the request to unsubscribe from the data producer - subscription ID: mock-subscription-id, status code: 500",
        );

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if we receive an empty response from the data producer", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(null),
            status: 200,
            ok: true,
        } as unknown as Response);

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "No response body received from the data producer - subscription ID: mock-subscription-id",
        );

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if invalid xml received from the data producer's response", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionInvalidBody),
            status: 200,
            ok: true,
        } as unknown as Response);

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "Error parsing the terminate subscription response from the data producer",
        );

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if data producer does not return a status of true", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockFailedSubscriptionResponseBody),
            status: 200,
            ok: true,
        } as unknown as Response);

        getDynamoItemSpy.mockResolvedValue({
            PK: "mock-subscription-id",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });

        await expect(handler(mockUnsubscribeEvent)).rejects.toThrowError(
            "The data producer did not return a status of true - subscription ID: mock-subscription-id",
        );

        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });
});