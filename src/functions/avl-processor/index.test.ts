import { KyselyDb } from "@bods-integrated-data/shared/database";
import { S3EventRecord } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processSqsRecord } from ".";
import {
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
                key: "test-key",
            },
        },
    };

    beforeEach(() => {
        vi.restoreAllMocks();
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
        await processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb);

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
        await processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb);

        expect(valuesMock).toHaveBeenCalledWith(parsedSiriWithOnwardCalls[0]);
        expect(valuesMock).toHaveBeenCalledWith(parsedSiriWithOnwardCalls[1]);
        expect(valuesMock).toHaveBeenCalledWith(onwardCallInsertQuery);
    });

    it("does not insert to database if invalid", async () => {
        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testInvalidSiri } });

        await expect(processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb)).rejects.toThrowError();

        expect(valuesMock).not.toBeCalled();
    });
});
