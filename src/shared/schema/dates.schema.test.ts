import dayjs, { extend as dayjsExtend } from "dayjs";
import utc from "dayjs/plugin/utc";
import { describe, expect, it, vi } from "vitest";
import { BankHolidayOperation, getTransformedBankHolidayOperationSchema } from "./dates.schema";
import { BankHolidaysJson } from "../dates";

dayjsExtend(utc);

const bankHolidaysJson: BankHolidaysJson = {
    "england-and-wales": {
        division: "england-and-wales",
        events: [],
    },
    scotland: {
        division: "scotland",
        events: [],
    },
    "northern-ireland": {
        division: "northern-ireland",
        events: [],
    },
};

const schema: BankHolidayOperation = {
    AugustBankHolidayScotland: "",
    Jan2ndScotland: "",
    // Testing for both if a date is passed and if not
    OtherPublicHoliday: [{ Date: "2024-01-01T00:00:00.000Z" }, {}],
};

describe("getTransformedBankHolidayOperationSchema", () => {
    vi.mock("../dates", () => ({
        createBankHolidayFunctions: () => {
            return { getNextOccurrenceOfBankHoliday: () => dayjs.utc("2024-08-05T00:00:00.000Z") };
        },
        getNextOccurrenceOfDate: () => dayjs.utc("2024-01-02T00:00:00.000Z"),
        getDate: () => dayjs.utc("2024-01-01T00:00:00.000Z"),
    }));

    it("gets the transformed schema", () => {
        expect(getTransformedBankHolidayOperationSchema(bankHolidaysJson, schema)).toStrictEqual([
            "20240805",
            "20240102",
            "20240101",
        ]);
    });
});
