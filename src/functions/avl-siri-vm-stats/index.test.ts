import * as utilFunctions from "@bods-integrated-data/shared/avl/utils";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { APIGatewayEvent, APIGatewayProxyEvent } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("avl-siri-vm-stats", () => {
    const mocks = vi.hoisted(() => {
        return {
            mockDbClient: {
                destroy: vi.fn(),
            },
        };
    });

    vi.mock("@bods-integrated-data/shared/database", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/database")>()),
        getDatabaseClient: vi.fn().mockReturnValue(mocks.mockDbClient),
    }));

    vi.mock("@bods-integrated-data/shared/avl/utils");

    const getLatestAvlVehicleCountMock = vi.spyOn(utilFunctions, "getLatestAvlVehicleCount");

    const mockRequest: APIGatewayEvent = {} as APIGatewayProxyEvent;

    afterEach(() => {
        vi.clearAllMocks();
        getLatestAvlVehicleCountMock.mockReset();
    });

    it("should return a 200 and with stats in the body if successful", async () => {
        getLatestAvlVehicleCountMock.mockResolvedValueOnce({ vehicle_count: 1234 });

        await expect(handler(mockRequest, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify({ num_of_siri_vehicles: 1234 }),
        });
    });

    it("should return a 500 if the database query is not successful", async () => {
        getLatestAvlVehicleCountMock.mockRejectedValueOnce(new Error());

        const response = await handler(mockRequest, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
    });
});
