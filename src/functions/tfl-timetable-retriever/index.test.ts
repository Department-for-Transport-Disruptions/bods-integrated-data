import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrefixWithLatestDate, handler } from ".";

describe("tfl-timetable-retriever", () => {
    const mockBucketName = "mock-bucket";

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        listS3Objects: vi.fn().mockResolvedValue({
            CommonPrefixes: [{ Prefix: "20250101/" }],
        }),
        putS3Object: vi.fn(),
    }));

    vi.mock("@aws-sdk/client-s3");

    beforeEach(() => {
        process.env.TFL_TIMETABLES_ZIPPED_BUCKET_NAME = mockBucketName;
    });

    describe("getPrefixWithLatestDate", () => {
        it("returns the prefix with the latest date", () => {
            const prefixes = ["20250101/", "20250201/", "20250301/"];
            const result = getPrefixWithLatestDate(prefixes);
            expect(result).toBe("20250301/");
        });

        it("returns undefined when no valid date prefixes are found", () => {
            const prefixes = ["invalid/", "another-invalid/"];
            const result = getPrefixWithLatestDate(prefixes);
            expect(result).toBeUndefined();
        });

        it("handles an empty array of prefixes", () => {
            const prefixes: string[] = [];
            const result = getPrefixWithLatestDate(prefixes);
            expect(result).toBeUndefined();
        });
    });

    describe("handler", () => {
        it("throws an error when the TFL_TIMETABLES_ZIPPED_BUCKET_NAME environment variable is missing", async () => {
            process.env.TFL_TIMETABLES_ZIPPED_BUCKET_NAME = "";

            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
                "Missing env vars - TFL_TIMETABLES_ZIPPED_BUCKET_NAME must be set",
            );

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the TfL timetable retriever function",
            );
        });

        it("throws an error when no prefixes with a valid date are found", async () => {
            // @ts-ignore mock S3Client
            vi.mocked(S3Client.prototype.send).mockResolvedValue({ CommonPrefixes: [{ Prefix: "invalid-prefix/" }] });

            await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
                "No prefixes with a valid date found in the S3 bucket",
            );

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the TfL timetable retriever function",
            );
        });

        it("logs a warning and skips retrieval when the prefix already exists", async () => {
            // @ts-ignore mock S3Client
            vi.mocked(S3Client.prototype.send).mockResolvedValue({ CommonPrefixes: [{ Prefix: "20250101/" }] });

            await handler(mockEvent, mockContext, mockCallback);

            expect(logger.warn).toHaveBeenCalledWith('Prefix "20250101/" already exists, skipping retrieval');
        });

        it("retrieves files from the S3 bucket", async () => {
            const mockBody = [1, 2, 3];

            // @ts-ignore mock S3Client
            vi.mocked(S3Client.prototype.send).mockImplementation((command) => {
                if (command instanceof ListObjectsV2Command) {
                    return {
                        CommonPrefixes: [{ Prefix: "20250102/" }],
                        Contents: [{ Key: "file1.zip" }, { Key: "file2.zip" }],
                    };
                }
                if (command instanceof GetObjectCommand) {
                    return { Body: { transformToByteArray: () => Promise.resolve(mockBody) } };
                }
            });

            const putS3ObjectMock = vi.fn();
            vi.mocked(putS3Object).mockImplementation(putS3ObjectMock);

            await handler(mockEvent, mockContext, mockCallback);

            expect(logger.info).toHaveBeenCalledWith('Prefix with latest date: "20250102/"');
            expect(logger.info).toHaveBeenCalledWith("Retrieving 2 files");
            expect(putS3ObjectMock).toHaveBeenCalledTimes(2);
            expect(putS3ObjectMock).toHaveBeenCalledWith({
                Bucket: mockBucketName,
                Key: "file1.zip",
                Body: mockBody,
            });
            expect(putS3ObjectMock).toHaveBeenCalledWith({
                Bucket: mockBucketName,
                Key: "file2.zip",
                Body: mockBody,
            });
        });
    });
});
