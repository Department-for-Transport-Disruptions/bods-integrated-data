import * as cloudwatch from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import * as secretsManagerFunctions from "@bods-integrated-data/shared/secretsManager";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTotalAvlsProcessed, handler } from ".";
import { mockNoErrorsResponse, mockResponseString } from "./test/mockResponse";

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
        getDynamoItem: vi.fn(),
        recursiveQuery: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/secretsManager", () => ({
        getSecret: vi.fn(),
    }));

    const getSecretMock = vi.spyOn(secretsManagerFunctions, "getSecret");

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const recursiveQuerySpy = vi.spyOn(dynamo, "recursiveQuery");

    const runLogInsightsQuerySpy = vi.spyOn(cloudwatch, "runLogInsightsQuery");

    MockDate.set("2024-03-11T00:00:00.000Z");
    const mockSubscriptionId = "411e4495-4a57-4d2f-89d5-cf105441f321";
    let mockEvent: APIGatewayProxyEventV2;

    beforeEach(() => {
        process.env.AVL_VALIDATION_ERROR_TABLE = "test-dynamodb";
        process.env.AVL_SUBSCRIPTIONS_TABLE_NAME = "test-sub-dynamodb";
        process.env.AVL_PROCESSOR_LOG_GROUP_NAME = "test";
        process.env.AVL_PRODUCER_API_KEY_ARN = "mock-api-key";

        getSecretMock.mockResolvedValue("mock-api-key");

        mockEvent = {
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
            headers: {
                "x-api-key": "mock-api-key",
            },
        } as unknown as APIGatewayProxyEventV2;

        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "live",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        });

        recursiveQuerySpy.mockResolvedValue([
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

    it("should get total avl processed from cloudwatch with correct date", async () => {
        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: mockResponseString,
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(cloudwatch.runLogInsightsQuery).toBeCalled();
        expect(cloudwatch.runLogInsightsQuery).toBeCalledWith<Parameters<typeof cloudwatch.runLogInsightsQuery>>(
            "test",
            getDate().subtract(24, "hours").unix(),
            getDate().unix(),
            `filter msg = "AVL processed successfully" and subscriptionId = "${mockSubscriptionId}"
        | stats count(*) as avlProcessed`,
        );
    });

    it("throws an error when the required env vars are missing", async () => {
        process.env.AVL_VALIDATION_ERROR_TABLE = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrowError(
            "An unexpected error occurred",
        );

        expect(logger.error).toHaveBeenCalledWith("There was a problem with the avl data feed validator endpoint");
    });

    it("throws a validation error when invalid data passed", async () => {
        const mockInvalidEvent = {
            pathParameters: {
                subscriptionId: 123,
            },
            headers: {
                "x-api-key": "mock-api-key",
            },
        } as unknown as APIGatewayProxyEventV2;
        const response = await handler(mockInvalidEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 400,
            body: JSON.stringify({ errors: ["subscriptionId must be a string"] }),
        });
        expect(logger.warn).toHaveBeenCalledWith("Invalid request", expect.anything());
    });

    it("should add total number of avl items processed", async () => {
        const response = await getTotalAvlsProcessed(mockSubscriptionId, "test");
        expect(response).toEqual(2);
    });

    it("should return 0 when no avl items processed", async () => {
        runLogInsightsQuerySpy.mockResolvedValueOnce([[]]);
        const response = await getTotalAvlsProcessed(mockSubscriptionId, "test");
        expect(response).toEqual(0);
    });

    it("should return default values for validation if no errors are found", async () => {
        recursiveQuerySpy.mockResolvedValue([]);

        await expect(handler(mockEvent, mockContext, mockCallback)).resolves.toEqual({
            statusCode: 200,
            body: JSON.stringify(mockNoErrorsResponse),
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(cloudwatch.runLogInsightsQuery).toBeCalled();
        expect(cloudwatch.runLogInsightsQuery).toBeCalledWith<Parameters<typeof cloudwatch.runLogInsightsQuery>>(
            "test",
            getDate().subtract(24, "hours").unix(),
            getDate().unix(),
            `filter msg = "AVL processed successfully" and subscriptionId = "${mockSubscriptionId}"
        | stats count(*) as avlProcessed`,
        );
    });

    it("should throw a not found error if subscription ID is not found", async () => {
        getDynamoItemSpy.mockResolvedValueOnce(null);

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({
                errors: ["Subscription not found"],
            }),
        });
    });

    it("should throw a not found error if subscription is inactive", async () => {
        getDynamoItemSpy.mockResolvedValueOnce({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "inactive",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        });

        const response = await handler(mockEvent, mockContext, mockCallback);
        expect(response).toEqual({
            statusCode: 404,
            body: JSON.stringify({
                errors: ["Subscription is not live"],
            }),
        });
    });
});
