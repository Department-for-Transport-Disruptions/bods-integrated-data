import * as cloudwatch from "@bods-integrated-data/shared/cloudwatch";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
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
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        getMetricStatistics: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        putDynamoItem: vi.fn(),
        getDynamoItem: vi.fn(),
        recursiveScan: vi.fn(),
    }));

    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");
    const getMetricStatisticsSpy = vi.spyOn(cloudwatch, "getMetricStatistics");

    MockDate.set("2024-03-11T00:00:00.000Z");
    const mockFeedId = "411e4495-4a57-4d2f-89d5-cf105441f321";
    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        process.env.AVL_VALIDATION_ERROR_TABLE = "test-dynamodb";
        process.env.CLOUDWATCH_NAMESPACE = "test-namespace";

        mockEvent = {
            pathParameters: {
                feedId: mockFeedId,
            },
        } as unknown as APIGatewayProxyEvent;

        recursiveScanSpy.mockResolvedValue([
            {
                PK: mockFeedId,
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
                PK: mockFeedId,
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

        const timestamp = new Date("2023-07-15T00:00:00Z");
        getMetricStatisticsSpy.mockResolvedValue({
            $metadata: {},
            Label: "TotalAvlProcessed",
            Datapoints: [
                {
                    Timestamp: timestamp,
                    Sum: 1.0,
                    Unit: "Count",
                },
                {
                    Timestamp: timestamp,
                    Sum: 1.0,
                    Unit: "Count",
                },
            ],
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("Should log a warning when an unknown error category is passed", async () => {
        const mockValue = {
            PK: mockFeedId,
            SK: "12a345b6-2be9-49bb-852f-21e5a2400ea6",
            details: "Required",
            filename: "test",
            itemIdentifier: undefined,
            level: "CRITICAL",
            lineRef: "ATB:Line:60",
            name: "Test",
            operatorRef: "123",
            recordedAtTime: "2024-03-11T00:05:00.000Z",
            responseTimestamp: "2024-03-11T00:00:00.000Z",
            timeToExist: 1710374400,
            vehicleJourneyRef: undefined,
            vehicleRef: "200141",
        };
        recursiveScanSpy.mockResolvedValue([mockValue]);

        await handler(mockEvent);
        expect(logger.warn).toHaveBeenCalledWith("Unknown error category: ", mockValue);
    });

    it("Should get total avl processed from cloudwatch with correct date", async () => {
        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200, body: mockResponseString });

        expect(cloudwatch.getMetricStatistics).toBeCalled();
        expect(cloudwatch.getMetricStatistics).toBeCalledWith<Parameters<typeof cloudwatch.getMetricStatistics>>(
            "test-namespace",
            "TotalAvlProcessed",
            ["Sum"],
            new Date("2024-03-10T00:00:00.000Z"),
            new Date("2024-03-11T00:00:00.000Z"),
            300,
            [{ Name: "SubscriptionId", Value: mockFeedId }],
        );
    });

    it("Throws an error when the required env vars are missing", async () => {
        process.env.AVL_VALIDATION_ERROR_TABLE = "";
        process.env.CLOUDWATCH_NAMESPACE = "";

        const response = await handler(mockEvent);
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
                feedId: 123,
            },
        } as unknown as APIGatewayProxyEvent;
        const response = await handler(mockInvalidEvent);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["feedId must be a string"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
    });

    it("Should add total number of avl items processed", async () => {
        const response = await getTotalAvlsProcessed(mockFeedId, "test-namespace");
        expect(response).toEqual(2);
    });

    it("Should throw an error if no datapoints retrieved", async () => {
        getMetricStatisticsSpy.mockResolvedValue({
            $metadata: {},
            Label: "TotalAvlProcessed",
            Datapoints: undefined,
        });

        const response = await handler(mockEvent);
        expect(response).toEqual({
            statusCode: 500,
            body: JSON.stringify({ errors: ["An unexpected error occurred"] }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            "There was a problem with the avl data feed validator endpoint",
            expect.anything(),
        );
    });
});
