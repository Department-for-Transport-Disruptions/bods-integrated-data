import * as crypto from "node:crypto";
import * as cloudwatch from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { AvlValidationError } from "@bods-integrated-data/shared/schema/avl-validation-error.schema";
import { S3EventRecord } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { processSqsRecord } from ".";
import {
    expectedPutMetricDataCall,
    expectedPutMetricDataCallForFilteredArrayParseError,
    mockItemId,
    mockSubscriptionId,
    onwardCallInsertQuery,
    parsedSiri,
    parsedSiriWithOnwardCalls,
    testInvalidSiri,
    testSiri,
    testSiriWithOnwardCalls,
} from "./test/testSiriVm";

describe("avl-processor", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
        };
    });

    vi.mock("node:crypto", () => ({
        randomUUID: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
        putDynamoItems: vi.fn(),
    }));

    MockDate.set("2024-07-22T12:00:00.000Z");
    const uuidSpy = vi.spyOn(crypto, "randomUUID");
    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemsSpy = vi.spyOn(dynamo, "putDynamoItems");
    const putMetricDataSpy = vi.spyOn(cloudwatch, "putMetricData");

    const valuesMock = vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(""),
        returning: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue({
                id: 123,
            }),
        }),
    });

    const dbClient = {
        insertInto: () => ({
            values: valuesMock,
        }),
    };

    const record = {
        s3: {
            bucket: {
                name: "test-bucket",
            },
            object: {
                key: `${mockSubscriptionId}/test-key`,
            },
        },
    };

    beforeAll(() => {
        process.env.STAGE = "dev";
    });

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.resetAllMocks();

        const avlSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "LIVE",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        getDynamoItemSpy.mockResolvedValue(avlSubscription);
        uuidSpy.mockReturnValue(mockItemId);
    });

    it("correctly processes a siri-vm file", async () => {
        const valuesMock = vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(""),
        });

        const dbClient = {
            insertInto: () => ({
                values: valuesMock,
            }),
        };

        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testSiri } });
        await processSqsRecord(
            record as S3EventRecord,
            dbClient as unknown as KyselyDb,
            "table-name",
            "avl-validation-errors-table",
        );

        expect(uuidSpy).toHaveBeenCalledOnce();

        expect(valuesMock).toBeCalledWith(parsedSiri);
        expect(putMetricDataSpy).toHaveBeenCalledOnce();
        expect(putMetricDataSpy).toHaveBeenCalledWith(
            expectedPutMetricDataCall.namespace,
            expectedPutMetricDataCall.metricData,
            expectedPutMetricDataCall.metricDimensions,
        );
    });

    it("correctly processes a siri-vm file with OnwardCalls data", async () => {
        const valuesMock = vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(""),
            returning: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({
                    id: 123,
                }),
            }),
        });

        const dbClient = {
            insertInto: () => ({
                values: valuesMock,
            }),
        };

        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testSiriWithOnwardCalls } });
        await processSqsRecord(
            record as S3EventRecord,
            dbClient as unknown as KyselyDb,
            "table-name",
            "avl-validation-errors-table",
        );

        expect(valuesMock).toHaveBeenNthCalledWith(1, [parsedSiriWithOnwardCalls[0]]);
        expect(valuesMock).toHaveBeenNthCalledWith(2, parsedSiriWithOnwardCalls[1]);
        expect(valuesMock).toHaveBeenNthCalledWith(3, onwardCallInsertQuery);

        expect(putMetricDataSpy).toHaveBeenCalledOnce();
        expect(putMetricDataSpy).toHaveBeenCalledWith(
            expectedPutMetricDataCall.namespace,
            expectedPutMetricDataCall.metricData,
            expectedPutMetricDataCall.metricDimensions,
        );
    });

    it("does not insert to database if invalid", async () => {
        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testInvalidSiri } });

        await expect(
            processSqsRecord(
                record as S3EventRecord,
                dbClient as unknown as KyselyDb,
                "table-name",
                "avl-validation-errors-table",
            ),
        ).rejects.toThrowError();

        expect(valuesMock).not.toHaveBeenCalled();

        expect(putMetricDataSpy).toHaveBeenCalledTimes(2);
        expect(putMetricDataSpy).toHaveBeenNthCalledWith(
            1,
            expectedPutMetricDataCallForFilteredArrayParseError.namespace,
            expectedPutMetricDataCallForFilteredArrayParseError.metricData,
        );
        expect(putMetricDataSpy).toHaveBeenNthCalledWith(
            2,
            expectedPutMetricDataCallForFilteredArrayParseError.namespace,
            expectedPutMetricDataCallForFilteredArrayParseError.metricData,
        );
    });

    it("uploads validation errors to dynamoDB when processing invalid data", async () => {
        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testInvalidSiri } });

        await expect(
            processSqsRecord(
                record as S3EventRecord,
                dbClient as unknown as KyselyDb,
                "table-name",
                "avl-validation-errors-table",
            ),
        ).rejects.toThrowError();

        const timeToExist = getDate().add(3, "days").unix();

        const expectedValidationErrors: AvlValidationError[] = [
            {
                PK: mockSubscriptionId,
                details: "Required",
                filename: record.s3.object.key,
                itemIdentifier: undefined,
                level: "NON-CRITICAL",
                lineRef: "ATB:Line:60",
                name: "MonitoredVehicleJourney.FramedVehicleJourneyRef.DataFrameRef",
                operatorRef: "123",
                recordedAtTime: "2018-08-17T15:22:20",
                responseTimestamp: "2018-08-17T15:14:21.432",
                timeToExist,
                vehicleJourneyRef: undefined,
                vehicleRef: "200141",
            },
            {
                PK: mockSubscriptionId,
                details: "Expected number, received nan",
                filename: record.s3.object.key,
                itemIdentifier: undefined,
                level: "NON-CRITICAL",
                lineRef: "ATB:Line:60",
                name: "MonitoredVehicleJourney.VehicleLocation.Longitude",
                operatorRef: "123",
                recordedAtTime: "2018-08-17T15:22:20",
                responseTimestamp: "2018-08-17T15:14:21.432",
                timeToExist,
                vehicleJourneyRef: undefined,
                vehicleRef: "200141",
            },
            {
                PK: mockSubscriptionId,
                details: "Required",
                filename: record.s3.object.key,
                level: "CRITICAL",
                name: "ServiceDelivery.ProducerRef",
                responseTimestamp: "2018-08-17T15:14:21.432",
                timeToExist,
            },
        ];
        expect(putDynamoItemsSpy).toHaveBeenCalledWith("avl-validation-errors-table", expectedValidationErrors);
    });

    it.each(["ERROR", "INACTIVE"] as const)("throws an error when the subscription is not active", async (status) => {
        const avlSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status,
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        getDynamoItemSpy.mockResolvedValue(avlSubscription);

        await expect(
            processSqsRecord(
                record as S3EventRecord,
                dbClient as unknown as KyselyDb,
                "table-name",
                "avl-validation-errors-table",
            ),
        ).rejects.toThrowError(`Unable to process AVL for subscription ${mockSubscriptionId} with status ${status}`);

        expect(valuesMock).not.toHaveBeenCalled();

        expect(putMetricDataSpy).not.toHaveBeenCalledOnce();
    });
});
