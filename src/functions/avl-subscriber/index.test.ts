import { APIGatewayEvent } from "aws-lambda";
import * as MockDate from "mockdate";
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import { expectedSubscriptionRequest, mockSubscribeEvent, mockSubscriptionResponseBody } from "./test/mockData";
import { handler } from "./index";
vi.mock("crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("avl-subscriber", () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    MockDate.set("2024-03-11T15:20:02.093Z");

    beforeEach(() => {
        vi.resetAllMocks;
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should generate a valid subscription request if a valid input is passed", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionResponseBody),
            status: 200,
            ok: true,
        } as unknown as Response);

        await handler(mockSubscribeEvent);

        expect(fetch).toBeCalledWith(
            "https://mock-data-producer.com/5965q7gh-5428-43e2-a75c-1782a48637d5",
            expectedSubscriptionRequest,
        );
    });

    it("should throw an error if we do not receive a subscription response from the data producer", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockSubscriptionResponseBody),
            status: 500,
            ok: false,
        } as unknown as Response);

        await expect(async () => await handler(mockSubscribeEvent)).rejects.toThrowError(
            "There was an error when sending the subscription request to the data producer: 500",
        );
    });

    it("should throw an error if no xml is received from the response", async () => {
        fetchSpy.mockResolvedValue({
            text: vi.fn().mockResolvedValue(null),
            status: 200,
            ok: true,
        } as unknown as Response);

        await expect(async () => await handler(mockSubscribeEvent)).rejects.toThrowError(
            "No response body received from the data producer.",
        );
    });

    it("should throw an error if the body from the API gateway event does not match the schema.", async () => {
        const invalidEvent = {
            body: JSON.stringify({
                test: "invalid event",
            }),
        } as unknown as APIGatewayEvent;

        await expect(async () => await handler(invalidEvent)).rejects.toThrowError(
            "Invalid subscribe message from event body.",
        );
    });
});
