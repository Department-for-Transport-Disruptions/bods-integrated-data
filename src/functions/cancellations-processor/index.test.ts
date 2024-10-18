import * as crypto from "node:crypto";
import * as cloudwatch from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import {
    AvlSubscription,
    CancellationsSubscription,
    CancellationsValidationError,
} from "@bods-integrated-data/shared/schema";
import { S3EventRecord } from "aws-lambda";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { processSqsRecord } from ".";
import {
    mockSubscriptionId,
    parsedSiriSx,
    testInvalidSiriSx,
    testSiriSx,
    testSiriSxWithInvalidSituationsAndData,
    testSiriSxWithInvalidSituationsOnly,
} from "./test/testSiriSx";

describe("cancellations-processor", () => {
    const mocks = vi.hoisted(() => ({
        getS3Object: vi.fn(),
    }));

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
    });

    const dbClient = {
        insertInto: () => ({
            values: vi.fn().mockReturnValue({
                onConflict: valuesMock,
            }),
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

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.resetAllMocks();

        const cancellationsSubscription: AvlSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "live",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        uuidSpy.mockReturnValue("12a345b6-2be9-49bb-852f-21e5a2400ea6");
        getDynamoItemSpy.mockResolvedValue(cancellationsSubscription);
    });

    it.each(["live", "error"] as const)(
        "correctly processes siri-sx data when the subscription has status of %o",
        async (status) => {
            const cancellationsSubscription: CancellationsSubscription = {
                PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status,
                requestorRef: null,
                publisherId: "test-publisher-id",
                apiKey: "mock-api-key",
            };

            const valuesMock = vi.fn().mockReturnValue({
                onConflict: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(""),
                }),
            });

            const dbClient = {
                insertInto: () => ({
                    values: valuesMock,
                }),
            };

            getDynamoItemSpy.mockResolvedValue(cancellationsSubscription);
            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testSiriSx } });

            await processSqsRecord(
                record as S3EventRecord,
                dbClient as unknown as KyselyDb,
                "table-name",
                "cancellations-validation-errors-table",
            );

            expect(valuesMock).toHaveBeenCalledWith(parsedSiriSx);
        },
    );

    it("throws an error when the subscription is inactive", async () => {
        const cancellationsSubscription: CancellationsSubscription = {
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "inactive",
            requestorRef: null,
            publisherId: "test-publisher-id",
            apiKey: "mock-api-key",
        };

        getDynamoItemSpy.mockResolvedValue(cancellationsSubscription);

        await expect(
            processSqsRecord(
                record as S3EventRecord,
                dbClient as unknown as KyselyDb,
                "table-name",
                "cancellations-validation-errors-table",
            ),
        ).rejects.toThrowError(
            `Unable to process cancellations for subscription ${mockSubscriptionId} because it is inactive`,
        );

        expect(valuesMock).not.toHaveBeenCalled();

        expect(putMetricDataSpy).not.toHaveBeenCalledOnce();
    });

    it("does not insert data into the database when the siri-sx is invalid", async () => {
        mocks.getS3Object.mockResolvedValueOnce({
            Body: { transformToString: () => testInvalidSiriSx },
        });

        await processSqsRecord(
            record as S3EventRecord,
            dbClient as unknown as KyselyDb,
            "table-name",
            "cancellations-validation-errors-table",
        );

        expect(valuesMock).not.toHaveBeenCalled();
    });

    it("only inserts valid siri-sx situations into the database", async () => {
        const expectedPutMetricDataCallForFilteredArrayParseError = {
            namespace: "custom/SiriSxPtSituationArraySchema",
            metricData: [
                {
                    MetricName: "MakeFilteredPtSituationArrayParseError",
                    Value: 1,
                },
            ],
            metricDimensions: [
                {
                    Name: "SubscriptionId",
                    Value: "123",
                },
            ],
        };

        const valuesMock = vi.fn().mockReturnValue({
            onConflict: vi.fn().mockReturnValue({
                execute: vi.fn().mockResolvedValue(""),
            }),
        });

        const dbClient = {
            insertInto: () => ({
                values: valuesMock,
            }),
        };

        mocks.getS3Object.mockResolvedValueOnce({
            Body: { transformToString: () => testSiriSxWithInvalidSituationsOnly },
        });

        await processSqsRecord(
            record as S3EventRecord,
            dbClient as unknown as KyselyDb,
            "table-name",
            "cancellations-validation-errors-table",
        );

        expect(valuesMock).toHaveBeenCalledWith(parsedSiriSx.slice(0, 1));

        expect(putMetricDataSpy).toHaveBeenCalledTimes(1);
        expect(putMetricDataSpy).toHaveBeenNthCalledWith(
            1,
            expectedPutMetricDataCallForFilteredArrayParseError.namespace,
            expectedPutMetricDataCallForFilteredArrayParseError.metricData,
        );
    });

    it("uploads validation errors to dynamoDB", async () => {
        /**
         * This variable represents a time to live (TTL) in the dynamoDB table
         * in order for dynamoDB to automatically clear entries older than the TTL:
         * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
         */
        const timeToExist = getDate().add(3, "days").unix();

        const expectedValidationErrors: CancellationsValidationError[] = [
            {
                PK: mockSubscriptionId,
                SK: "12a345b6-2be9-49bb-852f-21e5a2400ea6",
                timeToExist,
                details: "Required one of",
                filename: record.s3.object.key,
                name: "MiscellaneousReason, PersonnelReason, EquipmentReason, EnvironmentReason",
                responseTimestamp: "asdf",
                situationNumber: "123",
                version: "2",
            },
            {
                PK: mockSubscriptionId,
                SK: "12a345b6-2be9-49bb-852f-21e5a2400ea6",
                timeToExist,
                details: "Invalid datetime",
                filename: record.s3.object.key,
                name: "Siri.ServiceDelivery.ResponseTimestamp",
                responseTimestamp: "asdf",
                responseMessageIdentifier: "444",
                producerRef: "ATB",
            },
        ];

        mocks.getS3Object.mockResolvedValueOnce({
            Body: { transformToString: () => testSiriSxWithInvalidSituationsAndData },
        });

        await processSqsRecord(
            record as S3EventRecord,
            dbClient as unknown as KyselyDb,
            "table-name",
            "cancellations-validation-errors-table",
        );

        expect(putDynamoItemsSpy).toHaveBeenCalledWith(
            "cancellations-validation-errors-table",
            expectedValidationErrors,
        );
    });
});
