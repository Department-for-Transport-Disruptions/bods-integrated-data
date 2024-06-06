import { KyselyDb } from "@bods-integrated-data/shared/database";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { S3EventRecord } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processSqsRecord } from ".";
import {
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

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");

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

    beforeEach(() => {
        vi.resetAllMocks();

        getDynamoItemSpy.mockResolvedValue({
            PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
            url: "https://mock-data-producer.com/",
            description: "test-description",
            shortDescription: "test-short-description",
            status: "ACTIVE",
            requestorRef: null,
        });
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
        await processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb, "table-name");

        expect(valuesMock).toBeCalledWith(parsedSiri);
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
        await processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb, "table-name");

        expect(valuesMock).toHaveBeenNthCalledWith(1, [parsedSiriWithOnwardCalls[0]]);
        expect(valuesMock).toHaveBeenNthCalledWith(2, parsedSiriWithOnwardCalls[1]);
        expect(valuesMock).toHaveBeenNthCalledWith(3, onwardCallInsertQuery);
    });

    it("does not insert to database if invalid", async () => {
        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testInvalidSiri } });

        await expect(
            processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb, "table-name"),
        ).rejects.toThrowError();

        expect(valuesMock).not.toBeCalled();
    });

    it.each(["FAILED", "TERMINATED", "UNAVAILABLE"])(
        "throws an error when the subscription is not active",
        async (status) => {
            getDynamoItemSpy.mockResolvedValue({
                PK: "411e4495-4a57-4d2f-89d5-cf105441f321",
                url: "https://mock-data-producer.com/",
                description: "test-description",
                shortDescription: "test-short-description",
                status,
                requestorRef: null,
            });

            await expect(
                processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb, "table-name"),
            ).rejects.toThrowError(
                `Unable to process AVL for subscription ${mockSubscriptionId} with status ${status}`,
            );

            expect(valuesMock).not.toBeCalled();
        },
    );
});
