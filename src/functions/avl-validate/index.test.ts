import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { APIGatewayProxyEvent } from "aws-lambda";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import {
    expectedCheckStatusRequestBody,
    expectedCheckStatusRequestBodyWithCustomRequestorRef,
    expectedCheckStatusRequestConfig,
    mockAvlValidateRequest,
    mockCheckStatusResponse,
    mockCheckStatusResponseFalse,
} from "./test/mockData";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("avl-validate", () => {
    let mockEvent: APIGatewayProxyEvent;

    MockDate.set("2024-03-11T15:20:02.093Z");

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    const axiosSpy = vi.spyOn(mockedAxios, "post");
    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    process.env.AVL_PRODUCER_API_KEY_ARN = "mock-key-arn";

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.resetAllMocks();

        mockEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
            body: JSON.stringify(mockAvlValidateRequest),
        } as unknown as APIGatewayProxyEvent;

        getSecretMock.mockResolvedValue("mock-api-key");
    });

    it("should return a status code of 200 and the data producers SIRI version if a producer's feed can be successfully validated", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockCheckStatusResponse,
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify({ siriVersion: "2.0" }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedCheckStatusRequestBody,
            expectedCheckStatusRequestConfig,
        );
    });

    it("should return a status code of 200 and use the data producers requestorRef if provided", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockCheckStatusResponse,
            status: 200,
        } as AxiosResponse);

        mockEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
            body: JSON.stringify({ ...mockAvlValidateRequest, requestorRef: "TEST-REF" }),
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify({ siriVersion: "2.0" }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedCheckStatusRequestBodyWithCustomRequestorRef,
            expectedCheckStatusRequestConfig,
        );
    });

    it.each([
        [null, ["Body must be an object with required properties"]],
        ["", ["Body must be an object with required properties"]],
        [{}, ["url is required", "username is required", "password is required"]],
        [
            {
                test: "invalid event",
            },
            ["url is required", "username is required", "password is required"],
        ],
        [
            {
                url: null,
                username: null,
                password: null,
            },
            ["url must be a string", "username must be a string", "password must be a string"],
        ],
        [
            {
                url: 1,
                username: 1,
                password: 1,
            },
            ["url must be a string", "username must be a string", "password must be a string"],
        ],
        [
            {
                url: {},
                username: {},
                password: {},
            },
            ["url must be a string", "username must be a string", "password must be a string"],
        ],
        [
            {
                url: "https://example.com",
                username: "",
                password: "",
            },
            ["username must be 1-256 characters", "password must be 1-256 characters"],
        ],
        [
            {
                url: "asdf",
                username: "1".repeat(257),
                password: "1".repeat(257),
            },
            ["url must be a valid URL", "username must be 1-256 characters", "password must be 1-256 characters"],
        ],
    ])(
        "should throw an error if the event body from the API gateway event does not match the avlValidateMessage schema (test: %o)",
        async (input, expectedErrorMessages) => {
            mockEvent.body = JSON.stringify(input);

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({ errors: expectedErrorMessages }),
            });

            expect(axiosSpy).not.toHaveBeenCalledOnce();
        },
    );

    it("should return a 400 if there is an error when sending the request to the data producer", async () => {
        mockedAxios.post.mockImplementation(() => {
            throw new AxiosError();
        });

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid request to data producer"] }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedCheckStatusRequestBody,
            expectedCheckStatusRequestConfig,
        );
    });

    it("should return a 200 and siri version of unknown if invalid XML is received from the data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: "<Siri>invalid</Siri>",
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify({ siriVersion: "Unknown" }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedCheckStatusRequestBody,
            expectedCheckStatusRequestConfig,
        );
    });

    it.each([null, undefined, ""])(
        "should return a 200 and siri version of unknown if an empty body is received from the data producer (test: %o)",
        async (response) => {
            mockedAxios.post.mockResolvedValue({
                data: response,
                status: 200,
            } as AxiosResponse);

            await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
                statusCode: 200,
                body: JSON.stringify({ siriVersion: "Unknown" }),
            });

            expect(axiosSpy).toHaveBeenCalledWith(
                mockAvlValidateRequest.url,
                expectedCheckStatusRequestBody,
                expectedCheckStatusRequestConfig,
            );
        },
    );

    it("should return a 400 if a data producer does not return a status of true", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockCheckStatusResponseFalse,
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Data producer did not return a status of true"] }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedCheckStatusRequestBody,
            expectedCheckStatusRequestConfig,
        );
    });

    it.each([[undefined], ["invalid-key"]])("should return a 401 when an invalid api key is supplied", async (key) => {
        mockEvent.headers = {
            "x-api-key": key,
        };

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 401,
            body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
    });
});
