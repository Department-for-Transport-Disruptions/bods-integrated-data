import { KyselyDb } from "@bods-integrated-data/shared/database";
import { S3EventRecord } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parsedSiri, testInvalidSiri, testSiri } from "./test/testSiriVm";
import { processSqsRecord } from ".";

describe("avl-processor", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
        };
    });

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object.mockResolvedValue({ Body: { transformToString: () => testSiri } }),
    }));

    const valuesMock = vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(""),
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

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("correctly processes a siri-vm file", async () => {
        await processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb);

        expect(valuesMock).toBeCalledWith(parsedSiri);
    });

    it("does not insert to database if invalid", async () => {
        mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => testInvalidSiri } });

        await expect(processSqsRecord(record as S3EventRecord, dbClient as unknown as KyselyDb)).rejects.toThrowError();

        expect(valuesMock).not.toBeCalled();
    });
});
