import { z } from "zod";
import { getDate, getNextOccurrenceOfBankHoliday, getNextOccurrenceOfDate } from "../dates";
import { notEmpty, txcSelfClosingProperty } from "../utils";

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
                    Date: z.string(),
                })
                .array()
                .optional(),
        }),
    );

export type BankHolidayOperation = z.infer<typeof bankHolidayOperationSchema>;

const allBankHolidays: Record<keyof (FixedBankHoliday & VariableBankHoliday), string> = {
    StAndrewsDay: getNextOccurrenceOfDate(30, 10).format("YYYYMMDD"),
    ChristmasEve: getNextOccurrenceOfDate(24, 11).format("YYYYMMDD"),
    ChristmasDay: getNextOccurrenceOfDate(25, 11).format("YYYYMMDD"),
    BoxingDay: getNextOccurrenceOfDate(26, 11).format("YYYYMMDD"),
    NewYearsEve: getNextOccurrenceOfDate(31, 11).format("YYYYMMDD"),
    NewYearsDay: getNextOccurrenceOfDate(1, 0).format("YYYYMMDD"),
    Jan2ndScotland: getNextOccurrenceOfDate(2, 0).format("YYYYMMDD"),
    AugustBankHolidayScotland: getNextOccurrenceOfBankHoliday("Scotland Summer bank holiday").format("YYYYMMDD"),
    BoxingDayHoliday: getNextOccurrenceOfBankHoliday("Boxing Day").format("YYYYMMDD"),
    ChristmasDayHoliday: getNextOccurrenceOfBankHoliday("Christmas Day").format("YYYYMMDD"),
    EasterMonday: getNextOccurrenceOfBankHoliday("Easter Monday").format("YYYYMMDD"),
    GoodFriday: getNextOccurrenceOfBankHoliday("Good Friday").format("YYYYMMDD"),
    Jan2ndScotlandHoliday: getNextOccurrenceOfBankHoliday("2nd January").format("YYYYMMDD"),
    LateSummerBankHolidayNotScotland: getNextOccurrenceOfBankHoliday("Summer bank holiday").format("YYYYMMDD"),
    MayDay: getNextOccurrenceOfBankHoliday("Early May bank holiday").format("YYYYMMDD"),
    NewYearsDayHoliday: getNextOccurrenceOfBankHoliday("New Year’s Day").format("YYYYMMDD"),
    SpringBank: getNextOccurrenceOfBankHoliday("Spring bank holiday").format("YYYYMMDD"),
    StAndrewsDayHoliday: getNextOccurrenceOfBankHoliday("St Andrew’s Day").format("YYYYMMDD"),
};

const bankHolidaySubGroupMapping: Record<keyof BankHolidayOperationSubGroup, string[]> = {
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

const bankHolidayGroupMapping: Record<keyof BankHolidayOperationGroup, string[]> = {
    AllBankHolidays: [
        ...bankHolidaySubGroupMapping.AllHolidaysExceptChristmas,
        ...bankHolidaySubGroupMapping.Christmas,
        ...bankHolidaySubGroupMapping.DisplacementHolidays,
    ],
    EarlyRunOffDays: [allBankHolidays.ChristmasEve, allBankHolidays.NewYearsEve],
};

const completeBankHolidayMapping: Record<string, string[] | string> = {
    ...allBankHolidays,
    ...bankHolidaySubGroupMapping,
    ...bankHolidayGroupMapping,
};

export const transformedBankHolidayOperationSchema = bankHolidayOperationSchema.transform((op) => [
    ...new Set(
        Object.keys(op)
            .flatMap((key) => {
                if (key !== "OtherPublicHoliday") {
                    return completeBankHolidayMapping[key];
                }

                if (op.OtherPublicHoliday) {
                    return op.OtherPublicHoliday.flatMap((holiday) => getDate(holiday.Date).format("YYYYMMDD"));
                }
            })
            .filter(notEmpty),
    ),
]);
