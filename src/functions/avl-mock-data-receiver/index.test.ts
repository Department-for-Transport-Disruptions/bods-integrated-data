import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("avl-mock-data-receiver", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    it("returns a 200 and logs the body", async () => {
        const mockEvent: APIGatewayProxyEvent = { body: "123" } as APIGatewayProxyEvent;
        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({ statusCode: 200, body: "" });
        expect(logger.info).toHaveBeenCalledWith(mockEvent.body);
    });
});
