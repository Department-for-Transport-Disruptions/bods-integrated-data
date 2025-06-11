import { TflTxcMetadata } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import MockDate from "mockdate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTxc } from ".";

const bankHolidays = [
    {
        name: "StAndrewsDay",
        date: getDate("2025-11-30T18:45:59.025Z"),
    },
    {
        name: "ChristmasEve",
        date: getDate("2025-12-24T18:45:59.026Z"),
    },
    {
        name: "ChristmasDay",
        date: getDate("2025-12-25T18:45:59.026Z"),
    },
    {
        name: "BoxingDay",
        date: getDate("2025-12-26T18:45:59.026Z"),
    },
    {
        name: "NewYearsEve",
        date: getDate("2025-12-01T18:45:59.026Z"),
    },
    {
        name: "NewYearsDay",
        date: getDate("2026-01-01T18:45:59.026Z"),
    },
    {
        name: "Jan2ndScotland",
        date: getDate("2026-01-02T18:45:59.026Z"),
    },
    {
        name: "AugustBankHolidayScotland",
        date: getDate("2025-08-04T00:00:00.000Z"),
    },
    {
        name: "BoxingDayHoliday",
        date: getDate("2025-12-26T00:00:00.000Z"),
    },
    {
        name: "ChristmasDayHoliday",
        date: getDate("2025-12-25T00:00:00.000Z"),
    },
    {
        name: "EasterMonday",
        date: getDate("2026-04-06T00:00:00.000Z"),
    },
    {
        name: "GoodFriday",
        date: getDate("2026-04-03T00:00:00.000Z"),
    },
    {
        name: "Jan2ndScotlandHoliday",
        date: getDate("2026-01-02T00:00:00.000Z"),
    },
    {
        name: "LateSummerBankHolidayNotScotland",
        date: getDate("2025-08-25T00:00:00.000Z"),
    },
    {
        name: "MayDay",
        date: getDate("2026-05-04T00:00:00.000Z"),
    },
    {
        name: "NewYearsDayHoliday",
        date: getDate("2026-01-01T00:00:00.000Z"),
    },
    {
        name: "SpringBank",
        date: getDate("2025-05-26T00:00:00.000Z"),
    },
    {
        name: "StAndrewsDayHoliday",
        date: getDate("2025-12-01T00:00:00.000Z"),
    },
];

describe("buildTxc", () => {
    beforeAll(() => {
        MockDate.set("2025-06-06T07:20:02.093Z");
    });

    afterAll(() => {
        MockDate.reset();
    });

    it.each([["100"], ["SL4"]])("builds TxC for %s", async (lineId) => {
        const metadata: TflTxcMetadata = {
            creation_datetime: getDate("2025-06-06T12:00:00Z").toISOString(),
            modification_datetime: getDate("2025-06-06T15:00:00Z").toISOString(),
            revision: 1,
            line_id: lineId,
        };

        const iBusData = await require(`./test-data/${lineId}.json`);
        const txc = await buildTxc(iBusData, metadata, bankHolidays);

        expect(txc).toMatchSnapshot();
    });
});
