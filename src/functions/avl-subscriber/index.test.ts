import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { describe, it, expect, vi, afterAll, beforeEach, beforeAll } from "vitest";
import {
    expectedSubscriptionRequest,
    expectedSubscriptionRequestForMockProducer,
    mockSubscribeEvent,
    mockSubscribeEventToMockDataProducer,
    mockSubscriptionResponseBody,
    mockSubscriptionResponseBodyFalseStatus,
} from "./test/mockData";
import { handler } from "./index";

vi.mock("crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

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

    const fetchSpy = vi.spyOn(global, "fetch");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should process a subscription request if a valid input is passed, including adding auth creds to parameter store and subscription details to DynamoDB", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionResponseBody),
            status: 200,
            ok: true,
        } as unknown as Response);

        await handler(mockSubscribeEvent);

        expect(fetch).toBeCalledWith("https://mock-data-producer.com", expectedSubscriptionRequest);

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
        fetchSpy.mockResolvedValue({
            text: "failed",
            status: 500,
            ok: false,
        } as unknown as Response);

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError(
            "There was an error when sending the subscription request to the data producer: https://mock-data-producer.com, status code: 500",
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

    it("should throw an error if we receive an empty response from the data producer", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(null),
            status: 200,
            ok: true,
        } as unknown as Response);

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

        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionResponseBody),
            status: 200,
            ok: true,
        } as unknown as Response);

        await handler(mockSubscribeEventToMockDataProducer);

        expect(fetch).toBeCalledWith("www.local.com", expectedSubscriptionRequestForMockProducer);

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
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue("<Siri/>"),
            status: 200,
            ok: true,
        } as unknown as Response);

        await expect(handler(mockSubscribeEventToMockDataProducer)).rejects.toThrowError(
            "Error parsing subscription response from: https://mock-data-producer.com",
        );
        expect(fetch).toBeCalledWith("www.local.com", expectedSubscriptionRequestForMockProducer);

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
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionResponseBodyFalseStatus),
            status: 200,
            ok: true,
        } as unknown as Response);

        await expect(handler(mockSubscribeEvent)).rejects.toThrowError(
            "The data producer: https://mock-data-producer.com did not return a status of true.",
        );
        expect(fetch).toBeCalledWith("https://mock-data-producer.com", expectedSubscriptionRequest);

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
});
