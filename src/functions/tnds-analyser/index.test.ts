import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { Operator, TxcSchema } from "@bods-integrated-data/shared/schema";
import { PartialDeep } from "type-fest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";
import { mockDynamoDbObservations, mockNaptanStopMap, mockTxcXmlParsed } from "./checks/mockData";
import * as utilFunctions from "./utils";

describe("tnds-analyser", () => {
    let mockEvent: Parameters<typeof handler>[0];
    const getAndParseTxcDataMock = vi.spyOn(utilFunctions, "getAndParseTxcData");
    const getNaptanStopDataMock = vi.spyOn(utilFunctions, "getNaptanStopData");
    const putDynamoItemsMock = vi.spyOn(dynamo, "putDynamoItems");

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
        process.env.NAPTAN_BUCKET_NAME = "test-naptan-bucket";
        process.env.NPTG_BUCKET_NAME = "test-nptg-bucket";
        process.env.GENERATE_ADVISORY_OBSERVATION_DETAIL = "";

        mockEvent = {
            date: "20250108",
            Records: [
                {
                    s3: {
                        bucket: { name: "test-bucket" },
                        object: { key: "test-file.xml" },
                    },
                },
            ],
        };
    });

    // Must be first in order to test global naptanStopMap variable
    it("fetches NaPTAN stop data only the first time when calling the handler multiple times", async () => {
        getAndParseTxcDataMock.mockResolvedValueOnce({});
        getNaptanStopDataMock.mockResolvedValue(mockNaptanStopMap);

        await handler(mockEvent, mockContext, mockCallback);
        expect(getNaptanStopDataMock).toHaveBeenCalledTimes(1);

        getAndParseTxcDataMock.mockResolvedValueOnce({});
        getNaptanStopDataMock.mockResolvedValue(mockNaptanStopMap);

        await handler(mockEvent, mockContext, mockCallback);
        expect(getNaptanStopDataMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            {
                TNDS_OBSERVATION_TABLE_NAME: "",
                NAPTAN_BUCKET_NAME: "test-naptan-bucket",
                NPTG_BUCKET_NAME: "test-nptg-bucket",
            },
        ],
        [{ TNDS_OBSERVATION_TABLE_NAME: "test-table", NAPTAN_BUCKET_NAME: "", NPTG_BUCKET_NAME: "test-nptg-bucket" }],
        [{ TNDS_OBSERVATION_TABLE_NAME: "test-table", NAPTAN_BUCKET_NAME: "test-naptan-bucket", NPTG_BUCKET_NAME: "" }],
    ])("throws an error when the required env vars are missing", async (env) => {
        process.env = env;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - TNDS_OBSERVATION_TABLE_NAME, NAPTAN_BUCKET_NAME and NPTG_BUCKET_NAME must be set",
        );
    });

    it("ignores non-xml files", async () => {
        mockEvent.Records[0].s3.object.key = "test-file.txt";
        await handler(mockEvent, mockContext, mockCallback);

        expect(logger.info).toHaveBeenCalledWith("Ignoring non-xml file");
        expect(getAndParseTxcDataMock).not.toHaveBeenCalled();
        expect(getNaptanStopDataMock).not.toHaveBeenCalled();
        expect(putDynamoItemsMock).not.toHaveBeenCalled();
    });

    it("makes observations for TXC data and uploads them to dynamo", async () => {
        getAndParseTxcDataMock.mockResolvedValueOnce(mockTxcXmlParsed);
        getNaptanStopDataMock.mockResolvedValueOnce(mockNaptanStopMap);
        putDynamoItemsMock.mockResolvedValueOnce();

        await handler(mockEvent, mockContext, mockCallback);

        const expected = mockDynamoDbObservations.map((o) => ({ ...o, details: undefined }));
        expect(putDynamoItemsMock).toHaveBeenCalledWith("test-table", expected);
    });

    it("sets the data source correctly", async () => {
        getAndParseTxcDataMock.mockResolvedValue(mockTxcXmlParsed);
        getNaptanStopDataMock.mockResolvedValue(mockNaptanStopMap);
        putDynamoItemsMock.mockResolvedValue();

        mockEvent.Records[0].s3.bucket.name = "test-bods-bucket";
        await handler(mockEvent, mockContext, mockCallback);

        const expected1 = mockDynamoDbObservations.map((o) => ({ ...o, dataSource: "bods", details: undefined }));
        expect(putDynamoItemsMock).toHaveBeenCalledWith("test-table", expected1);

        mockEvent.Records[0].s3.bucket.name = "test-tnds-bucket";
        await handler(mockEvent, mockContext, mockCallback);

        const expected2 = mockDynamoDbObservations.map((o) => ({ ...o, dataSource: "tnds", details: undefined }));
        expect(putDynamoItemsMock).toHaveBeenCalledWith("test-table", expected2);
    });

    it("doesn't attempt to upload to dynamo when no observations are made", async () => {
        getAndParseTxcDataMock.mockResolvedValueOnce({});
        getNaptanStopDataMock.mockResolvedValueOnce({});

        await handler(mockEvent, mockContext, mockCallback);

        expect(putDynamoItemsMock).not.toHaveBeenCalled();
    });

    it("sets the noc to unknown when it cannot be determined", async () => {
        const operator: Operator = {
            "@_id": "O1",
            OperatorCode: "ABCD-fallback",
            OperatorShortName: "Operator O1",
        };
        const mockTxcXmlParsedWithoutNoc: PartialDeep<TxcSchema> = {
            TransXChange: {
                ...structuredClone(mockTxcXmlParsed.TransXChange),
                Operators: { Operator: [operator] },
            },
        };

        getAndParseTxcDataMock.mockResolvedValueOnce(mockTxcXmlParsedWithoutNoc);
        getNaptanStopDataMock.mockResolvedValue(mockNaptanStopMap);
        putDynamoItemsMock.mockResolvedValue();

        await handler(mockEvent, mockContext, mockCallback);

        const expected1 = mockDynamoDbObservations.map((o) => ({ ...o, noc: "ABCD-fallback", details: undefined }));
        expect(putDynamoItemsMock).toHaveBeenCalledWith("test-table", expected1);

        operator.OperatorCode = undefined;

        getAndParseTxcDataMock.mockResolvedValueOnce(mockTxcXmlParsedWithoutNoc);
        getNaptanStopDataMock.mockResolvedValue(mockNaptanStopMap);
        putDynamoItemsMock.mockResolvedValue();

        await handler(mockEvent, mockContext, mockCallback);

        const expected2 = mockDynamoDbObservations.map((o) => ({ ...o, noc: "unknown", details: undefined }));
        expect(putDynamoItemsMock).toHaveBeenCalledWith("test-table", expected2);
    });

    it("includes observation details when the GENERATE_ADVISORY_OBSERVATION_DETAIL env var is set", async () => {
        process.env.GENERATE_ADVISORY_OBSERVATION_DETAIL = "true";
        getAndParseTxcDataMock.mockResolvedValueOnce(mockTxcXmlParsed);
        getNaptanStopDataMock.mockResolvedValueOnce(mockNaptanStopMap);
        putDynamoItemsMock.mockResolvedValueOnce();

        await handler(mockEvent, mockContext, mockCallback);

        expect(putDynamoItemsMock).toHaveBeenCalledWith("test-table", mockDynamoDbObservations);
    });
});
