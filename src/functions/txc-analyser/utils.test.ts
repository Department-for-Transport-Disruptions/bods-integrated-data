import { describe, expect, it, vi } from "vitest";
import { mockNaptanStopMap, mockNaptanStopsCsv, mockNptgXml, mockTxcXml, mockTxcXmlParsed } from "./checks/mockData";
import { getAndParseTxcData, getNaptanStopData } from "./utils";

describe("utils", () => {
    const mocks = vi.hoisted(() => ({
        getS3Object: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/s3", async () => ({
        getS3Object: mocks.getS3Object,
    }));

    describe("getAndParseTxcData", () => {
        it("return parsed data from the provided file", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => mockTxcXml } });

            const result = await getAndParseTxcData("test-bucket", "test-file.xml");
            expect(result).toEqual(mockTxcXmlParsed);
        });

        it("throws an error when the file content is empty", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => "" } });

            await expect(getAndParseTxcData("test-bucket", "test-file.xml")).rejects.toThrow("No xml data");
        });
    });

    describe("getNaptanStopData", () => {
        it("returns a naptan stop map", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => mockNptgXml } });
            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => mockNaptanStopsCsv } });

            const result = await getNaptanStopData("test-naptan-bucket", "test-nptg-bucket");
            expect(result).toEqual(mockNaptanStopMap);
        });
    });
});
