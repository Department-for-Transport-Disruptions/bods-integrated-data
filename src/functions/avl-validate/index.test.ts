import { APIGatewayProxyEvent } from "aws-lambda";
import axios, { AxiosError, AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import {
    expectedServiceDeliveryRequestBody,
    expectedServiceDeliveryRequestConfig,
    mockAvlValidateRequest,
    mockServiceDeliveryResponse,
    mockServiceDeliveryResponseFalse,
} from "./test/mockData";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("avl-validate", () => {
    let mockValidateEvent: APIGatewayProxyEvent;

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

        mockValidateEvent = {
            headers: {
                "x-api-key": "mock-api-key",
            },
            body: JSON.stringify(mockAvlValidateRequest),
        } as unknown as APIGatewayProxyEvent;

        getSecretMock.mockResolvedValue("mock-api-key");
    });

    it("should return a status code of 200 and the data producers SIRI version if a producer's feed can be successfully validated", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockServiceDeliveryResponse,
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockValidateEvent)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify({ siriVersion: "2.0" }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedServiceDeliveryRequestBody,
            expectedServiceDeliveryRequestConfig,
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
            mockValidateEvent.body = JSON.stringify(input);

            const response = await handler(mockValidateEvent);
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

        await expect(handler(mockValidateEvent)).resolves.toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid request to data producer"] }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedServiceDeliveryRequestBody,
            expectedServiceDeliveryRequestConfig,
        );
    });

    it("should return a 400 if invalid XML is received from the data producer", async () => {
        mockedAxios.post.mockResolvedValue({
            data: "<Siri>invalid</Siri>",
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockValidateEvent)).resolves.toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Invalid SIRI-VM XML received from the data producer"] }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedServiceDeliveryRequestBody,
            expectedServiceDeliveryRequestConfig,
        );
    });

    it("should return a 400 if a data producer does not return a status of true", async () => {
        mockedAxios.post.mockResolvedValue({
            data: mockServiceDeliveryResponseFalse,
            status: 200,
        } as AxiosResponse);

        await expect(handler(mockValidateEvent)).resolves.toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["Data producer did not return a status of true"] }),
        });

        expect(axiosSpy).toHaveBeenCalledWith(
            mockAvlValidateRequest.url,
            expectedServiceDeliveryRequestBody,
            expectedServiceDeliveryRequestConfig,
        );
    });

    it.each([[undefined], ["invalid-key"]])("should return a 401 when an invalid api key is supplied", async (key) => {
        mockValidateEvent.headers = {
            "x-api-key": key,
        };

        const response = await handler(mockValidateEvent);
        expect(response).toEqual({
            statusCode: 401,
            body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
    });
});
