import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("tnds-reporter", () => {
    const recursiveScanSpy = vi.spyOn(dynamo, "recursiveScan");

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        putS3Object: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    beforeAll(() => {
        MockDate.set("2025-01-08T00:00:00.000Z");
    });

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.TNDS_ANALYSIS_TABLE_NAME = "test-table";
        process.env.TNDS_ANALYSIS_BUCKET_NAME = "test-bucket";
    });

    it.each([
        [{ TNDS_ANALYSIS_TABLE_NAME: "", TNDS_ANALYSIS_BUCKET_NAME: "test-bucket" }],
        [{ TNDS_ANALYSIS_TABLE_NAME: "test-table", TNDS_ANALYSIS_BUCKET_NAME: "" }],
    ])("throws an error when the required env vars are missing", async (env) => {
        process.env = env;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - TNDS_ANALYSIS_TABLE_NAME and TNDS_ANALYSIS_BUCKET_NAME must be set",
        );
    });

    it("creates a report and uploads it to S3", async () => {
        const mockObservations: Observation[] = [
            {
                PK: "file1",
                SK: "a5764857-ae35-34dc-8f25-a9c9e73aa898",
                importance: "critical",
                category: "journey",
                observation: "Duplicate journey code",
                registrationNumber: "reg1",
                service: "service1",
                details: "details1",
            },
            {
                PK: "file2",
                SK: "a5764857-ae35-34dc-8f25-a9c9e73aa899",
                importance: "advisory",
                category: "dataset",
                observation: "Serviced organisation out of date",
                registrationNumber: "reg2",
                service: "service2",
                details: "details2",
            },
        ];

        const csvContent = `\uffeffilename,importance,category,observation,registrationNumber,service,details\r
file1,critical,journey,Duplicate journey code,reg1,service1,details1\r
file2,advisory,dataset,Serviced organisation out of date,reg2,service2,details2\r
`;

        recursiveScanSpy.mockResolvedValueOnce(mockObservations);

        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.info).toHaveBeenCalledWith("Creating report with 2 observations");
        expect(putS3Object).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "20250108.csv",
            ContentType: "text/csv",
            Body: csvContent,
        });
    });

    it("creates an empty report when there are no observations", async () => {
        const csvContent = "\uffeffilename,importance,category,observation,registrationNumber,service,details\r\n";
        recursiveScanSpy.mockResolvedValueOnce(undefined as unknown as Observation[]);

        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.info).toHaveBeenCalledWith("Creating report with 0 observations");
        expect(putS3Object).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "20250108.csv",
            ContentType: "text/csv",
            Body: csvContent,
        });
    });
});
