import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handler } from ".";

describe("avl-mock-data-receiver", () => {
    it("returns a 200", async () => {
        const mockEvent: APIGatewayProxyEvent = {
            body: "123",
        } as unknown as APIGatewayProxyEvent;

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({ statusCode: 200, body: "" });
    });

    it.each([
        [201, 201],
        [500, 500],
        ["asdf", 200],
    ])(
        "returns a custom status code when the statusCode query param is set (%o)",
        async (statusCode, expectedStatusCode) => {
            const mockEvent: APIGatewayProxyEvent = {
                queryStringParameters: {
                    statusCode,
                },
                body: "123",
            } as unknown as APIGatewayProxyEvent;

            const response = await handler(mockEvent, mockContext, mockCallback);
            expect(response).toEqual({ statusCode: expectedStatusCode, body: "" });
        },
    );
});
