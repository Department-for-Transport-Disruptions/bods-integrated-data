import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { ObservationSummary } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("tnds-reporter", () => {
    const mockEvent = { prefix: "20250108" };
    const scanDynamoSpy = vi.spyOn(dynamo, "scanDynamo");

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

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.TNDS_OBSERVATION_TABLE_NAME = "test-table";
        process.env.TNDS_ANALYSIS_BUCKET_NAME = "test-bucket";
    });

    it.each([
        [{ TNDS_OBSERVATION_TABLE_NAME: "", TNDS_ANALYSIS_BUCKET_NAME: "test-bucket" }],
        [{ TNDS_OBSERVATION_TABLE_NAME: "test-table", TNDS_ANALYSIS_BUCKET_NAME: "" }],
    ])("throws an error when the required env vars are missing", async (env) => {
        process.env = env;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - TNDS_OBSERVATION_TABLE_NAME and TNDS_ANALYSIS_BUCKET_NAME must be set",
        );
    });

    it("creates a report and uploads it to S3", async () => {
        const mockObservationSummaries: ObservationSummary[] = [
            {
                File: "file1",
                "Data Source": "bods",
                "Total observations": 2,
                "Critical observations": 2,
                "Advisory observations": 2,
                "No timing point for more than 15 minutes": 2,
                "First stop is not a timing point": 2,
                "Last stop is not a timing point": 2,
                "Last stop is pick up only": 2,
                "First stop is set down only": 2,
                "Stop not found in NaPTAN": 2,
                "Incorrect stop type": 2,
                "Missing journey code": 2,
                "Duplicate journey code": 2,
                "Duplicate journey": 2,
                "Missing bus working number": 2,
                "Serviced organisation out of date": 2,
            },
            {
                File: "file2",
                "Data Source": "tnds",
                "Total observations": 3,
                "Critical observations": 3,
                "Advisory observations": 3,
                "No timing point for more than 15 minutes": 3,
                "First stop is not a timing point": 3,
                "Last stop is not a timing point": 3,
                "Last stop is pick up only": 3,
                "First stop is set down only": 3,
                "Stop not found in NaPTAN": 3,
                "Incorrect stop type": 3,
                "Missing journey code": 3,
                "Duplicate journey code": 3,
                "Duplicate journey": 3,
                "Missing bus working number": 3,
                "Serviced organisation out of date": 3,
            },
            {
                File: "file3",
                "Data Source": "tnds",
                "Total observations": 5,
                "Critical observations": 5,
                "Advisory observations": 5,
                "No timing point for more than 15 minutes": 5,
                "First stop is not a timing point": 5,
                "Last stop is not a timing point": 5,
                "Last stop is pick up only": 5,
                "First stop is set down only": 5,
                "Stop not found in NaPTAN": 5,
                "Incorrect stop type": 5,
                "Missing journey code": 5,
                "Duplicate journey code": 5,
                "Duplicate journey": 5,
                "Missing bus working number": 5,
                "Serviced organisation out of date": 5,
            },
        ];

        const row1 = [
            "Data Source",
            "Total observations",
            "Critical observations",
            "Advisory observations",
            "No timing point for more than 15 minutes",
            "First stop is not a timing point",
            "Last stop is not a timing point",
            "Last stop is pick up only",
            "First stop is set down only",
            "Stop not found in NaPTAN",
            "Incorrect stop type",
            "Missing journey code",
            "Duplicate journey code",
            "Duplicate journey",
            "Missing bus working number",
            "Serviced organisation out of date",
        ];

        const row2: Omit<ObservationSummary, "File"> = {
            "Data Source": "bods",
            "Total observations": 2,
            "Critical observations": 2,
            "Advisory observations": 2,
            "No timing point for more than 15 minutes": 2,
            "First stop is not a timing point": 2,
            "Last stop is not a timing point": 2,
            "Last stop is pick up only": 2,
            "First stop is set down only": 2,
            "Stop not found in NaPTAN": 2,
            "Incorrect stop type": 2,
            "Missing journey code": 2,
            "Duplicate journey code": 2,
            "Duplicate journey": 2,
            "Missing bus working number": 2,
            "Serviced organisation out of date": 2,
        };

        const row3: Omit<ObservationSummary, "File"> = {
            "Data Source": "tnds",
            "Total observations": 8,
            "Critical observations": 8,
            "Advisory observations": 8,
            "No timing point for more than 15 minutes": 8,
            "First stop is not a timing point": 8,
            "Last stop is not a timing point": 8,
            "Last stop is pick up only": 8,
            "First stop is set down only": 8,
            "Stop not found in NaPTAN": 8,
            "Incorrect stop type": 8,
            "Missing journey code": 8,
            "Duplicate journey code": 8,
            "Duplicate journey": 8,
            "Missing bus working number": 8,
            "Serviced organisation out of date": 8,
        };

        const csvContent = `${row1}\r\n${Object.values(row2).join(",")}\r\n${Object.values(row3).join(",")}\r\n`;

        scanDynamoSpy.mockResolvedValueOnce({ Items: mockObservationSummaries } as unknown as Awaited<
            ReturnType<typeof dynamo.scanDynamo>
        >);

        await handler(mockEvent, mockContext, mockCallback);

        expect(putS3Object).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "20250108.csv",
            ContentType: "text/csv",
            Body: csvContent,
        });
    });

    it("doesn't create a report when there are no observation summaries", async () => {
        scanDynamoSpy.mockResolvedValueOnce({} as Awaited<ReturnType<typeof dynamo.scanDynamo>>);
        await handler(mockEvent, mockContext, mockCallback);
        expect(putS3Object).not.toHaveBeenCalled();
    });
});
