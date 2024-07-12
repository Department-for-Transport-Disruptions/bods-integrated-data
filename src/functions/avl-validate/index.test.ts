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
    mockValidateEvent,
} from "./test/mockData";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("avl-validate", () => {
    MockDate.set("2024-03-11T15:20:02.093Z");

    const axiosSpy = vi.spyOn(mockedAxios, "post");

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.resetAllMocks();
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
        "should throw an error if the event body from the API gateway event does not match the avlValidateMessage schema",
        async (input, expectedErrorMessages) => {
            const invalidEvent = { body: JSON.stringify(input) } as unknown as APIGatewayProxyEvent;

            const response = await handler(invalidEvent);
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
            body: JSON.stringify({ errors: ["Invalid request: "] }),
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
});
