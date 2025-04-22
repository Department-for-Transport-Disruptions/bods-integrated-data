import { Dayjs } from "dayjs";
import Mockdate from "mockdate";
import MockDate from "mockdate";
import { afterEach, describe, expect, it } from "vitest";
import { CalendarDateExceptionType, CalendarWithDates } from "./database";
import {
    BankHolidayName,
    BankHolidaysJson,
    checkCalendarsOverlap,
    createBankHolidayFunctions,
    getDate,
    getDatesInRange,
    getNextOccurrenceOfDate,
    getTflOriginAimedDepartureTime,
} from "./dates";

const bankHolidaysJson: BankHolidaysJson = {
    "england-and-wales": {
        division: "england-and-wales",
        events: [
            { title: "New Year’s Day", date: "2024-01-01", notes: "", bunting: true },
            { title: "Good Friday", date: "2024-03-29", notes: "", bunting: false },
            { title: "Easter Monday", date: "2024-04-01", notes: "", bunting: true },
            { title: "Early May bank holiday", date: "2024-05-06", notes: "", bunting: true },
            { title: "Spring bank holiday", date: "2024-05-27", notes: "", bunting: true },
            { title: "Summer bank holiday", date: "2024-08-26", notes: "", bunting: true },
            { title: "Christmas Day", date: "2024-12-25", notes: "", bunting: true },
            { title: "Boxing Day", date: "2024-12-26", notes: "", bunting: true },
        ],
    },
    scotland: {
        division: "scotland",
        events: [
            { title: "New Year’s Day", date: "2024-01-01", notes: "", bunting: true },
            { title: "2nd January", date: "2024-01-02", notes: "", bunting: true },
            { title: "Good Friday", date: "2024-03-29", notes: "", bunting: false },
            { title: "Early May bank holiday", date: "2024-05-06", notes: "", bunting: true },
            { title: "Spring bank holiday", date: "2024-05-27", notes: "", bunting: true },
            { title: "Summer bank holiday", date: "2024-08-05", notes: "", bunting: true },
            { title: "St Andrew’s Day", date: "2024-12-02", notes: "Substitute day", bunting: true },
            { title: "Christmas Day", date: "2024-12-25", notes: "", bunting: true },
            { title: "Boxing Day", date: "2024-12-26", notes: "", bunting: true },
        ],
    },
    "northern-ireland": {
        division: "northern-ireland",
        events: [
            { title: "New Year’s Day", date: "2024-01-01", notes: "", bunting: true },
            { title: "2nd January", date: "2024-01-02", notes: "", bunting: true },
            { title: "Good Friday", date: "2024-03-29", notes: "", bunting: false },
            { title: "Early May bank holiday", date: "2024-05-06", notes: "", bunting: true },
            { title: "Spring bank holiday", date: "2024-05-27", notes: "", bunting: true },
            { title: "Summer bank holiday", date: "2024-08-05", notes: "", bunting: true },
            { title: "St Andrew’s Day", date: "2024-12-02", notes: "Substitute day", bunting: true },
            { title: "Christmas Day", date: "2024-12-25", notes: "", bunting: true },
            { title: "Boxing Day", date: "2024-12-26", notes: "", bunting: true },
        ],
    },
};

describe("getNextOccurrenceOfBankHoliday", () => {
    Mockdate.set("2024-03-01");
    const { getNextOccurrenceOfBankHoliday } = createBankHolidayFunctions(bankHolidaysJson);

    it.each<[BankHolidayName, string]>([
        ["St Andrew’s Day", "2024-12-02T00:00:00.000Z"],
        ["Scotland Summer bank holiday", "2024-08-05T00:00:00.000Z"],
        ["Summer bank holiday", "2024-08-26T00:00:00.000Z"],
    ])("gets the next occurrence of a given holiday", (holiday, date) => {
        expect(getNextOccurrenceOfBankHoliday(holiday).toISOString()).toBe(date);
    });

    it("throws an error if bank holiday doesn't exist", () => {
        expect(() => getNextOccurrenceOfBankHoliday("New Year’s Day")).toThrow("Bank holiday not found");
    });
});

describe("getNextOccurrenceOfDate", () => {
    Mockdate.set("2024-03-01");
    it.each<[number, number, string]>([
        [4, 5, "2024-06-04T00:00:00.000Z"],
        [2, 2, "2024-03-02T00:00:00.000Z"],
        [1, 0, "2025-01-01T00:00:00.000Z"],
    ])("gets the next occurrence of a given date", (dateOfMonth, month, date) => {
        expect(getNextOccurrenceOfDate(dateOfMonth, month).toISOString()).toBe(date);
    });
});

describe("getDateRange", () => {
    Mockdate.set("2024-03-01");
    it.each<[Dayjs, Dayjs, Dayjs[]]>([
        [getDate("2024-01-01"), getDate("2024-01-01"), [getDate("2024-01-01")]],
        [
            getDate("2024-03-05"),
            getDate("2024-03-08"),
            [getDate("2024-03-05"), getDate("2024-03-06"), getDate("2024-03-07"), getDate("2024-03-08")],
        ],
        [getDate("2024-01-01"), getDate("2024-01-01"), [getDate("2024-01-01")]],
    ])("gets the next occurrence of a given date", (startDate, endDate, dates) => {
        expect(getDatesInRange(startDate, endDate)).toEqual(dates);
    });

    it("only includes dates up to 9 months in the future", () => {
        expect(getDatesInRange(getDate("2024-11-30"), getDate("2099-12-10"))).toEqual([
            getDate("2024-11-30"),
            getDate("2024-12-01"),
        ]);
    });

    describe("checkCalendarsOverlap", () => {
        it("returns true if calendars overlap with days of week", () => {
            const calendarA: CalendarWithDates = {
                calendar: {
                    id: 1,
                    start_date: "20240301",
                    end_date: "20240310",
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                    calendar_hash: "",
                },
                calendarDates: [],
            };
            const calendarB: CalendarWithDates = {
                calendar: {
                    id: 2,
                    start_date: "20240305",
                    end_date: "20240315",
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                    calendar_hash: "",
                },
                calendarDates: [],
            };

            expect(checkCalendarsOverlap(calendarA, calendarB)).toBe(true);
        });

        it("returns true if calendars overlap with calendar date exceptions", () => {
            const calendarA: CalendarWithDates = {
                calendar: {
                    id: 1,
                    start_date: "20240301",
                    end_date: "20240310",
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 1,
                    sunday: 1,
                    calendar_hash: "",
                },
                calendarDates: [
                    {
                        date: "20240306",
                        exception_type: CalendarDateExceptionType.ServiceAdded,
                    },
                ],
            };
            const calendarB: CalendarWithDates = {
                calendar: {
                    id: 2,
                    start_date: "20240305",
                    end_date: "20240315",
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                    calendar_hash: "",
                },
                calendarDates: [
                    {
                        date: "20240306",
                        exception_type: CalendarDateExceptionType.ServiceAdded,
                    },
                ],
            };

            expect(checkCalendarsOverlap(calendarA, calendarB)).toBe(true);
        });

        it("returns false if calendars don't have same date ranges", () => {
            const calendarA: CalendarWithDates = {
                calendar: {
                    id: 1,
                    start_date: "20240301",
                    end_date: "20240304",
                    monday: 0,
                    tuesday: 0,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 1,
                    sunday: 1,
                    calendar_hash: "",
                },
                calendarDates: [],
            };
            const calendarB: CalendarWithDates = {
                calendar: {
                    id: 2,
                    start_date: "20240305",
                    end_date: "20240315",
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                    calendar_hash: "",
                },
                calendarDates: [],
            };

            expect(checkCalendarsOverlap(calendarA, calendarB)).toBe(false);
        });

        it("returns false if calendars have no overlapping days", () => {
            const calendarA: CalendarWithDates = {
                calendar: {
                    id: 1,
                    start_date: "20240301",
                    end_date: "20240312",
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 1,
                    sunday: 1,
                    calendar_hash: "",
                },
                calendarDates: [],
            };
            const calendarB: CalendarWithDates = {
                calendar: {
                    id: 2,
                    start_date: "20240305",
                    end_date: "20240315",
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                    calendar_hash: "",
                },
                calendarDates: [],
            };

            expect(checkCalendarsOverlap(calendarA, calendarB)).toBe(false);
        });
    });

    describe("getTflOriginAimedDepartureTime", () => {
        afterEach(() => {
            MockDate.reset();
        });
        it.each([
            ["2024-05-21", "2024-05-21T02:25:40.000Z"],
            ["2024-12-21", "2024-12-21T03:25:40.000Z"],
        ])("should show the correct timestamp when date is: %o", (mockDate: string, expectedTimestamp: string) => {
            Mockdate.set(mockDate);
            expect(getTflOriginAimedDepartureTime(12340)).toEqual(expectedTimestamp);
        });
    });
});
