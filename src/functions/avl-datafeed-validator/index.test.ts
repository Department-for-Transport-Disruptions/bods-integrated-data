import * as cloudwatch from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { APIGatewayProxyEvent } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTotalAvlsProcessed, handler } from ".";
import { mockResponseString } from "./test/mockResponse";

describe("AVL-data-endpoint", () => {
    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        runLogInsightsQuery: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        putDynamoItem: vi.fn(),
        getDynamoItem: vi.fn(),
        recursiveScan: vi.fn(),
    }));

    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const runLogInsightsQuerySpy = vi.spyOn(cloudwatch, "runLogInsightsQuery");

    MockDate.set("2024-03-11T00:00:00.000Z");
    const mockSubscriptionId = "411e4495-4a57-4d2f-89d5-cf105441f321";
    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_VALIDATION_ERROR_TABLE = "test-dynamodb";

        mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
        } as unknown as APIGatewayProxyEvent;

        recursiveScanSpy.mockResolvedValue([
            {
                PK: mockSubscriptionId,
                SK: "12a345b6-2be9-49bb-852f-21e5a2400ea6",
                details: "Required",
                filename: "test",
                itemIdentifier: undefined,
                level: "CRITICAL",
                lineRef: "ATB:Line:60",
                name: "DestinationRef",
                operatorRef: "123",
                recordedAtTime: "2024-03-11T00:05:00.000Z",
                responseTimestamp: "2024-03-11T00:00:00.000Z",
                timeToExist: 1710374400,
                vehicleJourneyRef: undefined,
                vehicleRef: "200141",
            },
            {
                PK: mockSubscriptionId,
                SK: "12a345b6-2be9-49bb-852f-21e5a2400ea6",
                details: "Required",
                filename: "test",
                itemIdentifier: undefined,
                level: "NON-CRITICAL",
                lineRef: "ATB:Line:60",
                name: "BlockRef",
                operatorRef: "123",
                recordedAtTime: "2024-03-11T00:05:00.000Z",
                responseTimestamp: "2024-03-11T00:00:00.000Z",
                timeToExist: 1710374400,
                vehicleJourneyRef: undefined,
                vehicleRef: "200141",
            },
        ]);

        runLogInsightsQuerySpy.mockResolvedValue([[{ field: "avlProcessed", value: "2" }]]);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("Should get total avl processed from cloudwatch with correct date", async () => {
        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: mockResponseString,
        });

        expect(cloudwatch.runLogInsightsQuery).toBeCalled();
        expect(cloudwatch.runLogInsightsQuery).toBeCalledWith<Parameters<typeof cloudwatch.runLogInsightsQuery>>(
            getDate().subtract(24, "hours").unix(),
            getDate().unix(),
            `filter msg = "AVL processed successfully" and subscriptionId = "${mockSubscriptionId}"
        | stats count(*) as avlProcessed`,
        );
    });

    it("Throws an error when the required env vars are missing", async () => {
        process.env.AVL_VALIDATION_ERROR_TABLE = "";

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the avl data feed validator endpoint",
            expect.any(Error),
        );
    });

    it("Throws a validation error when invalid data passed", async () => {
        const mockInvalidEvent = {
            pathParameters: {
                subscriptionId: 123,
            },
        } as unknown as APIGatewayProxyEvent;
        const response = await handler(mockInvalidEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["subscriptionId must be a string"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
    });

    it("Should add total number of avl items processed", async () => {
        const response = await getTotalAvlsProcessed(mockSubscriptionId);
        expect(response).toEqual(2);
    });

    it("Should return 0 when no avl items processed", async () => {
        runLogInsightsQuerySpy.mockResolvedValueOnce([[]]);
        const response = await getTotalAvlsProcessed(mockSubscriptionId);
        expect(response).toEqual(0);
    });
});
