import { BankHoliday, getDate } from "@bods-integrated-data/shared/dates";
import { describe, expect, it } from "vitest";
import { createOperatingProfile } from "./vehicle-journeys";

const bankHolidays: BankHoliday[] = [
    { name: "ChristmasDay", date: getDate("2025-12-25") },
    { name: "BoxingDay", date: getDate("2025-12-26") },
    { name: "SpringBank", date: getDate("2025-05-26") },
    { name: "MayDay", date: getDate("2025-05-05") },
    { name: "EasterMonday", date: getDate("2025-04-21") },
];

describe("createOperatingProfile", () => {
    it("infers regular Mondays and missing SpringBank as a DayOfNonOperation", () => {
        const dates = [
            "2025-05-12", // Monday
            "2025-05-19", // Monday
            "2025-06-02", // Monday
        ];
        const profile = createOperatingProfile(dates, bankHolidays);

        expect(profile).toEqual({
            BankHolidayOperation: {
                DaysOfNonOperation: {
                    SpringBank: "",
                },
                DaysOfOperation: undefined,
            },
            RegularDayType: {
                DaysOfWeek: {
                    Sunday: undefined,
                    Monday: "",
                    Tuesday: undefined,
                    Wednesday: undefined,
                    Thursday: undefined,
                    Friday: undefined,
                    Saturday: undefined,
                },
            },
            SpecialDaysOperation: undefined,
        });
    });

    it("infers regular Tuesdays and include EasterMonday in DaysOfOperation", () => {
        const dates = [
            "2025-04-08", // Tuesday
            "2025-04-15", // Tuesday
            "2025-04-21", // Easter Monday
            "2025-04-22", // Tuesday
            "2025-04-29", // Tuesday
        ];
        const profile = createOperatingProfile(dates, bankHolidays);

        expect(profile).toEqual({
            BankHolidayOperation: {
                DaysOfNonOperation: undefined,
                DaysOfOperation: {
                    EasterMonday: "",
                },
            },
            RegularDayType: {
                DaysOfWeek: {
                    Sunday: undefined,
                    Monday: undefined,
                    Tuesday: "",
                    Wednesday: undefined,
                    Thursday: undefined,
                    Friday: undefined,
                    Saturday: undefined,
                },
            },
        });
    });

    it("handles multiple recurring DaysOfWeek and SpecialDaysOperation", () => {
        const dates = [
            "2025-05-21",
            "2025-05-22",
            "2025-05-23",
            "2025-05-27",
            "2025-05-28",
            "2025-05-29",
            "2025-05-30",
            "2025-06-02",
            "2025-06-03",
            "2025-06-04",
            "2025-06-05",
            "2025-06-06",
            "2025-06-09",
            "2025-06-10",
            "2025-06-11",
            "2025-06-12",
            "2025-06-13",
            "2025-06-20",
            "2025-06-27",
            "2025-07-04",
            "2025-07-11",
        ];
        const profile = createOperatingProfile(dates, bankHolidays);

        expect(profile).toEqual({
            BankHolidayOperation: {
                DaysOfOperation: undefined,
                DaysOfNonOperation: {
                    SpringBank: "",
                },
            },
            RegularDayType: {
                DaysOfWeek: {
                    Sunday: undefined,
                    Monday: "",
                    Tuesday: "",
                    Wednesday: "",
                    Thursday: "",
                    Friday: "",
                    Saturday: undefined,
                },
            },
            SpecialDaysOperation: {
                DaysOfNonOperation: {
                    DateRange: [
                        {
                            EndDate: "2025-06-16",
                            StartDate: "2025-06-16",
                        },
                        {
                            EndDate: "2025-06-17",
                            StartDate: "2025-06-17",
                        },
                        {
                            EndDate: "2025-06-18",
                            StartDate: "2025-06-18",
                        },
                        {
                            EndDate: "2025-06-19",
                            StartDate: "2025-06-19",
                        },
                        {
                            EndDate: "2025-06-23",
                            StartDate: "2025-06-23",
                        },
                        {
                            EndDate: "2025-06-24",
                            StartDate: "2025-06-24",
                        },
                        {
                            EndDate: "2025-06-25",
                            StartDate: "2025-06-25",
                        },
                        {
                            EndDate: "2025-06-26",
                            StartDate: "2025-06-26",
                        },
                        {
                            EndDate: "2025-06-30",
                            StartDate: "2025-06-30",
                        },
                        {
                            EndDate: "2025-07-01",
                            StartDate: "2025-07-01",
                        },
                        {
                            EndDate: "2025-07-02",
                            StartDate: "2025-07-02",
                        },
                        {
                            EndDate: "2025-07-03",
                            StartDate: "2025-07-03",
                        },
                        {
                            EndDate: "2025-07-07",
                            StartDate: "2025-07-07",
                        },
                        {
                            EndDate: "2025-07-08",
                            StartDate: "2025-07-08",
                        },
                        {
                            EndDate: "2025-07-09",
                            StartDate: "2025-07-09",
                        },
                        {
                            EndDate: "2025-07-10",
                            StartDate: "2025-07-10",
                        },
                    ],
                },
                DaysOfOperation: undefined,
            },
        });
    });

    it("treats dates as special or bank holidays if no regular pattern", () => {
        const dates = [
            "2025-12-19", // Friday
            "2025-12-25", // Christmas Day (Thursday)
        ];
        const profile = createOperatingProfile(dates, bankHolidays);

        expect(profile).toEqual({
            BankHolidayOperation: {
                DaysOfNonOperation: undefined,
                DaysOfOperation: {
                    ChristmasDay: "",
                },
            },
            RegularDayType: {
                HolidaysOnly: "",
            },
            SpecialDaysOperation: {
                DaysOfOperation: {
                    DateRange: [
                        {
                            StartDate: "2025-12-19",
                            EndDate: "2025-12-19",
                        },
                    ],
                },
                DaysOfNonOperation: undefined,
            },
        });
    });

    it("infers missing regular dates as special non-operating days", () => {
        const dates = [
            "2025-04-12", // Saturday
            "2025-04-26", // Saturday (missing 19th)
        ];
        const profile = createOperatingProfile(dates, bankHolidays);

        expect(profile).toEqual({
            BankHolidayOperation: undefined,
            RegularDayType: {
                DaysOfWeek: {
                    Sunday: undefined,
                    Monday: undefined,
                    Tuesday: undefined,
                    Wednesday: undefined,
                    Thursday: undefined,
                    Friday: undefined,
                    Saturday: "",
                },
            },
            SpecialDaysOperation: {
                DaysOfNonOperation: {
                    DateRange: [
                        {
                            StartDate: "2025-04-19",
                            EndDate: "2025-04-19",
                        },
                    ],
                },
            },
        });
    });

    it("handles empty input", () => {
        expect(() => createOperatingProfile([], bankHolidays)).toThrowError("No dates for operating profile");
    });
});
