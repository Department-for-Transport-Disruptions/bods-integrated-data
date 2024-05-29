import * as dynamo from "@bods-integrated-data/shared/dynamo";
import * as ssm from "@bods-integrated-data/shared/ssm";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

const mockedAxios = vi.mocked(axios, true);
describe("avl-feed-validator", () => {
    beforeAll(() => {
        process.env.TABLE_NAME = "test-dynamo-table";
        process.env.STAGE = "dev";
        process.env.SUBSCRIBE_ENDPOINT = "www.avl-service.com/subscribe";
    });

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        recursiveScan: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        getParameter: vi.fn(),
    }));

    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const getParameterSpy = vi.spyOn(ssm, "getParameter");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    MockDate.set("2024-04-29T15:15:00.000Z");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("should do nothing if no subscriptions are found to validate", async () => {
        recursiveScanSpy.mockResolvedValue([]);

        await handler();

        expect(getParameterSpy).not.toBeCalledTimes(2);
        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });
    it("should do nothing if all subscriptions have valid heartbeat notifications associated with them", async () => {
        recursiveScanSpy.mockResolvedValue([
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:14:30.000Z",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:14:30.000Z",
            },
        ]);

        await handler();

        expect(getParameterSpy).not.toBeCalledTimes(2);
        expect(putDynamoItemSpy).not.toHaveBeenCalledOnce();
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });
    it("should resubscribe to the data producer if we have not received a heartbeat notification for that subscription in the last 90 seconds", async () => {
        recursiveScanSpy.mockResolvedValue([
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
            },
        ]);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler();

        expect(getParameterSpy).toBeCalledTimes(2);
        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(axiosSpy).toBeCalledWith("www.avl-service.com/subscribe", {
            dataProducerEndpoint: "https://mock-data-producer.com/",
            description: "test-description",
            password: "test-password",
            requestorRef: null,
            shortDescription: "test-short-description",
            subscriptionId: "mock-subscription-id-1",
            username: "test-password",
        });
        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "UNAVAILABLE",
            url: "https://mock-data-producer.com/",
        });
    });
    it("should throw an error if we resubscribe to a data producer and a username or password is not found for that subscription", async () => {
        recursiveScanSpy.mockResolvedValue([
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
            },
        ]);

        getParameterSpy.mockResolvedValue({ Parameter: undefined });
        getParameterSpy.mockResolvedValue({ Parameter: undefined });

        await expect(handler()).rejects.toThrowError(
            "Cannot resubscribe to data produce as username or password is missing for subscription ID: mock-subscription-id-1.",
        );

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "UNAVAILABLE",
            url: "https://mock-data-producer.com/",
        });
        expect(axiosSpy).not.toHaveBeenCalledOnce();
    });
    it("should throw an error if we do not receive a 200 response from the /subscribe endpoint", async () => {
        recursiveScanSpy.mockResolvedValue([
            {
                PK: "mock-subscription-id-1",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-01-01T15:20:02.093Z",
                heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            },
            {
                PK: "mock-subscription-id-2",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status: "ACTIVE",
                requestorRef: null,
                serviceStartDatetime: "2024-04-29T15:15:30.000Z",
            },
        ]);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        mockedAxios.post.mockRejectedValue({
            message: "Request failed with status code 500",
            code: "500",
            isAxiosError: true,
            toJSON: () => {},
            name: "AxiosError",
        } as AxiosError);

        await expect(handler()).rejects.toThrowError("Request failed with status code 500");

        expect(putDynamoItemSpy).toHaveBeenCalledOnce();
        expect(putDynamoItemSpy).toBeCalledWith("test-dynamo-table", "mock-subscription-id-1", "SUBSCRIPTION", {
            PK: "mock-subscription-id-1",
            description: "test-description",
            heartbeatLastReceivedDateTime: "2024-04-29T15:00:00.000Z",
            requestorRef: null,
            serviceStartDatetime: "2024-01-01T15:20:02.093Z",
            shortDescription: "test-short-description",
            status: "UNAVAILABLE",
            url: "https://mock-data-producer.com/",
        });
        expect(axiosSpy).toHaveBeenCalledOnce();
        expect(axiosSpy).toHaveBeenCalledOnce();
    });
});
