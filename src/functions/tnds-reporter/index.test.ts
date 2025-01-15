import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { DynamoDbObservation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("tnds-reporter", () => {
    const mockEvent = { date: "20250108" };
    const scanDynamoMock = vi.spyOn(dynamo, "scanDynamo");

    const mocks = vi.hoisted(() => {
        return {
            abortMock: vi.fn(),
            appendMock: vi.fn(),
            startS3Upload: vi.fn(),
        };
    });

    vi.mock("archiver", () => ({
        default: vi.fn().mockImplementation(() => ({
            abort: mocks.abortMock,
            append: mocks.appendMock,
            finalize: vi.fn(),
            on: vi.fn(),
            pipe: vi.fn(),
        })),
    }));

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        startS3Upload: mocks.startS3Upload.mockReturnValue({
            done: () => Promise.resolve(),
        }),
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
        const mockObservations: DynamoDbObservation[] = [
            {
                PK: "test-PK-1",
                SK: "test-SK-1",
                dataSource: "test-dataSource-1",
                noc: "test-noc-1",
                region: "test-region-1",
                importance: "critical",
                category: "dataset",
                observation: "Duplicate journey",
                serviceCode: "test-service-1",
                lineName: "test-line-1",
                details: "test-details-1",
                extraColumns: {
                    "Extra Column": "test-extra-column-1",
                },
            },
            {
                PK: "test-PK-1",
                SK: "test-SK-2",
                dataSource: "test-dataSource-2",
                noc: "test-noc-2",
                region: "test-region-2",
                importance: "advisory",
                category: "dataset",
                observation: "First stop is not a timing point",
                serviceCode: "test-service-2",
                lineName: "test-line-2",
                details: "test-details-2",
            },
            {
                PK: "test-PK-1",
                SK: "test-SK-3",
                dataSource: "test-dataSource-2",
                noc: "test-noc-2",
                region: "test-region-2",
                importance: "advisory",
                category: "dataset",
                observation: "First stop is not a timing point",
                serviceCode: "test-service-2",
                lineName: "test-line-3",
                details: "test-details-2",
            },
        ];

        scanDynamoMock.mockResolvedValueOnce({ Items: mockObservations } as unknown as Awaited<
            ReturnType<typeof dynamo.scanDynamo>
        >);

        const observationSummariesByDataSourceCsvContent =
            "Dataset Date,Data Source,Total observations,Critical observations,Advisory observations,No timing point for more than 15 minutes,First stop is not a timing point,Last stop is not a timing point,Last stop is pick up only,First stop is set down only,Stop not found in NaPTAN,Incorrect stop type,Missing journey code,Duplicate journey code,Duplicate journey,Missing bus working number,Serviced organisation out of date\r\n08/01/2025,test-dataSource-1,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0\r\n08/01/2025,test-dataSource-2,2,0,2,0,2,0,0,0,0,0,0,0,0,0,0\r\n";

        const observationSummariesByFileCsvContent =
            "Dataset Date,Region,File,Data Source,Total observations,Critical observations,Advisory observations,No timing point for more than 15 minutes,First stop is not a timing point,Last stop is not a timing point,Last stop is pick up only,First stop is set down only,Stop not found in NaPTAN,Incorrect stop type,Missing journey code,Duplicate journey code,Duplicate journey,Missing bus working number,Serviced organisation out of date\r\n08/01/2025,test-region-1,test-PK-1,test-dataSource-1,3,1,2,0,2,0,0,0,0,0,0,0,1,0,0\r\n";

        const observationByObservationTypeCsvContent1 =
            "Dataset Date,Region,File,Data Source,National Operator Code,Service Code,Line Name,Quantity\r\n08/01/2025,test-region-1,test-PK-1,test-dataSource-1,test-noc-1,test-service-1,test-line-1,1\r\n";

        const observationByObservationTypeCsvContent2 =
            "Dataset Date,Region,File,Data Source,National Operator Code,Service Code,Line Name,Quantity\r\n08/01/2025,test-region-2,test-PK-1,test-dataSource-2,test-noc-2,test-service-2,test-line-2,2\r\n";

        const observationByObservationTypeCsvContent3 =
            "Dataset Date,Region,File,Data Source,National Operator Code,Service Code,Line Name,Quantity,Extra Column\r\n08/01/2025,test-region-1,test-PK-1,test-dataSource-1,test-noc-1,test-service-1,test-line-1,1,test-extra-column-1\r\n";

        await handler(mockEvent, mockContext, mockCallback);

        expect(mocks.startS3Upload).toHaveBeenCalledWith(
            "test-bucket",
            "20250108.zip",
            expect.anything(),
            "application/zip",
        );

        expect(mocks.appendMock).toHaveBeenCalledTimes(5);
        expect(mocks.appendMock).toHaveBeenNthCalledWith(1, observationSummariesByDataSourceCsvContent, {
            name: "20250108/observationSummariesByDataSource.csv",
        });
        expect(mocks.appendMock).toHaveBeenNthCalledWith(2, observationSummariesByFileCsvContent, {
            name: "20250108/observationSummariesByFile.csv",
        });
        expect(mocks.appendMock).toHaveBeenNthCalledWith(3, observationByObservationTypeCsvContent1, {
            name: "20250108/observationSummariesByObservationType/Duplicate journey.csv",
        });
        expect(mocks.appendMock).toHaveBeenNthCalledWith(4, observationByObservationTypeCsvContent2, {
            name: "20250108/observationSummariesByObservationType/First stop is not a timing point.csv",
        });
        expect(mocks.appendMock).toHaveBeenNthCalledWith(5, observationByObservationTypeCsvContent3, {
            name: "20250108/criticalObservationsByObservationType/Duplicate journey.csv",
        });
    });

    it("doesn't create a report when there are no observation summaries", async () => {
        scanDynamoMock.mockResolvedValueOnce({} as Awaited<ReturnType<typeof dynamo.scanDynamo>>);
        await handler(mockEvent, mockContext, mockCallback);
        expect(mocks.abortMock).not.toHaveBeenCalled();
        expect(mocks.startS3Upload).toHaveBeenCalled();
    });

    it("silently logs an error when an observation cannot be parsed from DynamoDB", async () => {
        const mockObservations = [
            {
                PK: "test-PK-1",
                SK: "test-SK-1",
            },
        ];

        scanDynamoMock.mockResolvedValueOnce({ Items: mockObservations } as unknown as Awaited<
            ReturnType<typeof dynamo.scanDynamo>
        >);

        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.error).toHaveBeenCalledWith(expect.anything(), "Error parsing dynamo item");
    });

    it("aborts the report upload when an unexpected error occurs", async () => {
        const mockObservations: DynamoDbObservation[] = [
            {
                PK: "test-PK-1",
                SK: "test-SK-1",
                dataSource: "test-dataSource-1",
                noc: "test-noc-1",
                region: "test-region-1",
                importance: "critical",
                category: "dataset",
                observation: "Duplicate journey",
                serviceCode: "test-service-1",
                lineName: "test-line-1",
                details: "test-details-1",
            },
        ];

        scanDynamoMock.mockResolvedValueOnce({ Items: mockObservations } as unknown as Awaited<
            ReturnType<typeof dynamo.scanDynamo>
        >);

        mocks.appendMock.mockImplementationOnce(() => {
            throw new Error("Unexpected error");
        });

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("Unexpected error");

        expect(mocks.abortMock).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.anything(), "Error creating and uploading zip file");
    });
});
