import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent } from "aws-lambda";
import MockDate from "mockdate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";
import { expectedSubscriptionResponse, mockSubscriptionRequest } from "./test/mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("avl-mock-data-producer-subscribe", () => {
    MockDate.set("2024-02-26T14:36:11+00:00");

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should throw an error if body from data consumer is not xml", async () => {
        const invalidXmlRequest = {
            body: "invalid xml",
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(invalidXmlRequest, mockContext, mockCallback)).rejects.toThrowError(InvalidXmlError);
    });

    it("should throw an error if invalid SIRI subscription request from data consumer is received", async () => {
        const invalidSubscriptionRequest = {
            body: `<?xml version='1.0' encoding='UTF-8' standalone='yes'?><InvalidRequest/>`,
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(invalidSubscriptionRequest, mockContext, mockCallback)).rejects.toThrowError(
            InvalidXmlError,
        );
    });

    it("should send a subscription response if valid subscription request is received", async () => {
        await expect(handler(mockSubscriptionRequest, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: expectedSubscriptionResponse,
        });
    });
});
