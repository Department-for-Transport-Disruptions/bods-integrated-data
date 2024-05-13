import { z } from "zod";
import {
    BankHolidaysJson,
    createBankHolidayFunctions,
    getDate,
    getDatesInRange,
    getNextOccurrenceOfDate,
} from "../dates";
import { notEmpty, txcSelfClosingProperty } from "../utils";

export const DEFAULT_DATE_FORMAT = "YYYYMMDD";

const fixedBankHolidaysSchema = z.object({
    BoxingDay: txcSelfClosingProperty.optional(),
    ChristmasDay: txcSelfClosingProperty.optional(),
    ChristmasEve: txcSelfClosingProperty.optional(),
    Jan2ndScotland: txcSelfClosingProperty.optional(),
    NewYearsDay: txcSelfClosingProperty.optional(),
    NewYearsEve: txcSelfClosingProperty.optional(),
    StAndrewsDay: txcSelfClosingProperty.optional(),
});

export type FixedBankHoliday = z.infer<typeof fixedBankHolidaysSchema>;

const variableBankHolidaysSchema = z.object({
    AugustBankHolidayScotland: txcSelfClosingProperty.optional(),
    BoxingDayHoliday: txcSelfClosingProperty.optional(),
    ChristmasDayHoliday: txcSelfClosingProperty.optional(),
    EasterMonday: txcSelfClosingProperty.optional(),
    GoodFriday: txcSelfClosingProperty.optional(),
    Jan2ndScotlandHoliday: txcSelfClosingProperty.optional(),
    LateSummerBankHolidayNotScotland: txcSelfClosingProperty.optional(),
    MayDay: txcSelfClosingProperty.optional(),
    NewYearsDayHoliday: txcSelfClosingProperty.optional(),
    SpringBank: txcSelfClosingProperty.optional(),
    StAndrewsDayHoliday: txcSelfClosingProperty.optional(),
});

export type VariableBankHoliday = z.infer<typeof variableBankHolidaysSchema>;

const bankHolidayOperationSubGroupSchema = z.object({
    AllHolidaysExceptChristmas: txcSelfClosingProperty.optional(),
    Christmas: txcSelfClosingProperty.optional(),
    DisplacementHolidays: txcSelfClosingProperty.optional(),
    HolidayMondays: txcSelfClosingProperty.optional(),
});

export type BankHolidayOperationSubGroup = z.infer<typeof bankHolidayOperationSubGroupSchema>;

const bankHolidayOperationGroupSchema = z.object({
    AllBankHolidays: txcSelfClosingProperty.optional(),
    EarlyRunOffDays: txcSelfClosingProperty.optional(),
});

export type BankHolidayOperationGroup = z.infer<typeof bankHolidayOperationGroupSchema>;

export const bankHolidayOperationSchema = fixedBankHolidaysSchema
    .and(variableBankHolidaysSchema)
    .and(bankHolidayOperationSubGroupSchema)
    .and(bankHolidayOperationGroupSchema)
    .and(
        z.object({
            OtherPublicHoliday: z
                .object({
                    Date: z.string().optional(),
                })
                .array()
                .optional(),
        }),
    );

export type BankHolidayOperation = z.infer<typeof bankHolidayOperationSchema>;

const getAllBankHolidays = (
    bankHolidaysJson: BankHolidaysJson,
): Record<keyof (FixedBankHoliday & VariableBankHoliday), string> => {
    const { getNextOccurrenceOfBankHoliday } = createBankHolidayFunctions(bankHolidaysJson);
    return {
        StAndrewsDay: getNextOccurrenceOfDate(30, 10).format(DEFAULT_DATE_FORMAT),
        ChristmasEve: getNextOccurrenceOfDate(24, 11).format(DEFAULT_DATE_FORMAT),
        ChristmasDay: getNextOccurrenceOfDate(25, 11).format(DEFAULT_DATE_FORMAT),
        BoxingDay: getNextOccurrenceOfDate(26, 11).format(DEFAULT_DATE_FORMAT),
        NewYearsEve: getNextOccurrenceOfDate(31, 11).format(DEFAULT_DATE_FORMAT),
        NewYearsDay: getNextOccurrenceOfDate(1, 0).format(DEFAULT_DATE_FORMAT),
        Jan2ndScotland: getNextOccurrenceOfDate(2, 0).format(DEFAULT_DATE_FORMAT),
        AugustBankHolidayScotland:
            getNextOccurrenceOfBankHoliday("Scotland Summer bank holiday").format(DEFAULT_DATE_FORMAT),
        BoxingDayHoliday: getNextOccurrenceOfBankHoliday("Boxing Day").format(DEFAULT_DATE_FORMAT),
        ChristmasDayHoliday: getNextOccurrenceOfBankHoliday("Christmas Day").format(DEFAULT_DATE_FORMAT),
        EasterMonday: getNextOccurrenceOfBankHoliday("Easter Monday").format(DEFAULT_DATE_FORMAT),
        GoodFriday: getNextOccurrenceOfBankHoliday("Good Friday").format(DEFAULT_DATE_FORMAT),
        Jan2ndScotlandHoliday: getNextOccurrenceOfBankHoliday("2nd January").format(DEFAULT_DATE_FORMAT),
        LateSummerBankHolidayNotScotland:
            getNextOccurrenceOfBankHoliday("Summer bank holiday").format(DEFAULT_DATE_FORMAT),
        MayDay: getNextOccurrenceOfBankHoliday("Early May bank holiday").format(DEFAULT_DATE_FORMAT),
        NewYearsDayHoliday: getNextOccurrenceOfBankHoliday("New Year’s Day").format(DEFAULT_DATE_FORMAT),
        SpringBank: getNextOccurrenceOfBankHoliday("Spring bank holiday").format(DEFAULT_DATE_FORMAT),
        StAndrewsDayHoliday: getNextOccurrenceOfBankHoliday("St Andrew’s Day").format(DEFAULT_DATE_FORMAT),
    };
};

const getBankHolidaySubGroupMapping = (
    allBankHolidays: Record<keyof (FixedBankHoliday & VariableBankHoliday), string>,
): Record<keyof BankHolidayOperationSubGroup, string[]> => {
    return {
        AllHolidaysExceptChristmas: [
            allBankHolidays.NewYearsDay,
            allBankHolidays.Jan2ndScotland,
            allBankHolidays.GoodFriday,
            allBankHolidays.StAndrewsDay,
            allBankHolidays.EasterMonday,
            allBankHolidays.MayDay,
            allBankHolidays.SpringBank,
            allBankHolidays.AugustBankHolidayScotland,
            allBankHolidays.LateSummerBankHolidayNotScotland,
        ],
        HolidayMondays: [
            allBankHolidays.EasterMonday,
            allBankHolidays.MayDay,
            allBankHolidays.SpringBank,
            allBankHolidays.AugustBankHolidayScotland,
            allBankHolidays.LateSummerBankHolidayNotScotland,
        ],
        Christmas: [allBankHolidays.ChristmasDay, allBankHolidays.BoxingDay],
        DisplacementHolidays: [
            allBankHolidays.ChristmasDayHoliday,
            allBankHolidays.BoxingDayHoliday,
            allBankHolidays.NewYearsDayHoliday,
            allBankHolidays.Jan2ndScotlandHoliday,
            allBankHolidays.StAndrewsDayHoliday,
        ],
    };
};

const getBankHolidayGroupMapping = (
    allBankHolidays: Record<keyof (FixedBankHoliday & VariableBankHoliday), string>,
    bankHolidaySubGroupMapping: Record<keyof BankHolidayOperationSubGroup, string[]>,
): Record<keyof BankHolidayOperationGroup, string[]> => {
    return {
        AllBankHolidays: [
            ...bankHolidaySubGroupMapping.AllHolidaysExceptChristmas,
            ...bankHolidaySubGroupMapping.Christmas,
            ...bankHolidaySubGroupMapping.DisplacementHolidays,
        ],
        EarlyRunOffDays: [allBankHolidays.ChristmasEve, allBankHolidays.NewYearsEve],
    };
};

/**
 * This function transforms the TXC bank holidays into actual dates to be used in the GTFS calendar_dates file, it also
 * extracts the dates of any OtherPublicHoliday items that may be in the TXC
 */
export const getTransformedBankHolidayOperationSchema = (
    bankHolidaysJson: BankHolidaysJson,
    schema: BankHolidayOperation,
) => {
    const allBankHolidays = getAllBankHolidays(bankHolidaysJson);
    const bankHolidaySubGroupMapping = getBankHolidaySubGroupMapping(allBankHolidays);
    const bankHolidayGroupMapping = getBankHolidayGroupMapping(allBankHolidays, bankHolidaySubGroupMapping);

    const completeBankHolidayMapping: Record<string, string[] | string> = {
        ...allBankHolidays,
        ...bankHolidaySubGroupMapping,
        ...bankHolidayGroupMapping,
    };

    const dates = Object.keys(schema)
        .flatMap((key) => {
            if (key === "OtherPublicHoliday") {
                return schema[key]?.flatMap((holiday) =>
                    holiday.Date ? getDate(holiday.Date).format(DEFAULT_DATE_FORMAT) : null,
                );
            } else {
                return completeBankHolidayMapping[key];
            }
        })
        .filter(notEmpty);

    return [...new Set(dates)];
};

export const dateRange = z
    .object({
        StartDate: z.string(),
        EndDate: z.string(),
    })
    .transform((range) => getDatesInRange(getDate(range.StartDate), getDate(range.EndDate)));

export const formattedDateRange = dateRange.transform((dates) => dates.map((date) => date.format(DEFAULT_DATE_FORMAT)));
