import axios, { AxiosError, AxiosResponse } from "axios";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as ssm from "./ssm";
import { sendTerminateSubscriptionRequest } from "./unsubscribe";
import {
    expectedRequestBody,
    expectedSubscriptionRequestConfig,
    mockFailedSubscriptionResponseBody,
    mockInput,
    mockSubscriptionInvalidBody,
    mockSubscriptionResponseBody,
} from "./unsubscribeMockData";
import { InvalidXmlError } from "./validation";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);
describe("sendTerminateSubscriptionRequest", () => {
    vi.mock("@bods-integrated-data/shared/ssm", () => ({
        deleteParameters: vi.fn(),
        getParameter: vi.fn(),
    }));

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
    it("should process a unsubscribe request for a subscription and update dynamo when valid inputs are passed", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        await sendTerminateSubscriptionRequest("avl", mockInput.subscriptionId, mockInput.subscription);

        expect(axiosSpy).toBeCalledWith(
            "https://mock-data-producer.com",
            expectedRequestBody,
            expectedSubscriptionRequestConfig,
        );
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

        await expect(
            sendTerminateSubscriptionRequest("avl", mockInput.subscriptionId, mockInput.subscription),
        ).rejects.toThrowError("Request failed with status code 500");

        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if we receive an empty response from the data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: null,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        await expect(
            sendTerminateSubscriptionRequest("avl", mockInput.subscriptionId, mockInput.subscription),
        ).rejects.toThrowError(
            "No response body received from the data producer - subscription ID: mock-subscription-id",
        );

        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if invalid xml received from the data producer's response", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockSubscriptionInvalidBody,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        await expect(
            sendTerminateSubscriptionRequest("avl", mockInput.subscriptionId, mockInput.subscription),
        ).rejects.toThrowError(InvalidXmlError);

        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if data producer does not return a status of true", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockFailedSubscriptionResponseBody,
            status: 200,
        } as AxiosResponse);

        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-username" } });
        getParameterSpy.mockResolvedValue({ Parameter: { Value: "test-password" } });

        await expect(
            sendTerminateSubscriptionRequest("avl", mockInput.subscriptionId, mockInput.subscription),
        ).rejects.toThrowError(
            "The data producer did not return a status of true - subscription ID: mock-subscription-id",
        );

        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });

    it("should throw an error if no auth creds are found for a subscription", async () => {
        getParameterSpy.mockResolvedValue({ Parameter: undefined });
        getParameterSpy.mockResolvedValue({ Parameter: undefined });

        await expect(
            sendTerminateSubscriptionRequest("avl", mockInput.subscriptionId, mockInput.subscription),
        ).rejects.toThrowError("Missing auth credentials for subscription");

        expect(deleteParametersSpy).not.toHaveBeenCalledOnce();
    });
});
