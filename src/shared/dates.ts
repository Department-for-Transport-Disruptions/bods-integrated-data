import dayjs, { extend as dayjsExtend, Dayjs, ManipulateType } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import ukBankHolidays from "./uk-bank-holidays.json";

dayjsExtend(timezone);
dayjsExtend(utc);
dayjsExtend(customParseFormat);
dayjsExtend(isSameOrAfter);
dayjsExtend(isSameOrBefore);
dayjsExtend(isBetween);

dayjs.tz.setDefault("Europe/London");

export const getDate = (input?: string) => dayjs(input);

export type BankHolidayName =
    | "New Year’s Day"
    | "2nd January"
    | "Good Friday"
    | "Easter Monday"
    | "Early May bank holiday"
    | "Spring bank holiday"
    | "Summer bank holiday"
    | "Scotland Summer bank holiday"
    | "St Andrew’s Day"
    | "Christmas Day"
    | "Boxing Day";

const mappedScottishHolidays = [...ukBankHolidays["scotland"].events].map((holiday) => {
    if (holiday.title === "Summer bank holiday") {
        return {
            ...holiday,
            title: "Scotland Summer bank holiday",
        };
    }

    return holiday;
});

const bankHolidays = [...ukBankHolidays["england-and-wales"].events, ...mappedScottishHolidays].sort((a, b) =>
    a.date.localeCompare(b.date),
);

const futureBankHolidays = bankHolidays.slice(
    bankHolidays.findIndex((holiday) => getDate(holiday.date).isSameOrAfter(getDate())) - 1,
);

export const getNextOccurrenceOfBankHoliday = (bankHoliday: BankHolidayName) => {
    const date = futureBankHolidays.find((holiday) => holiday.title.startsWith(bankHoliday))?.date;

    if (!date) {
        throw new Error("Bank holiday not found");
    }

    return getDate(date);
};

export const getNextOccurrenceOfDate = (dateOfMonth: number, month: number) => {
    const date = getDate().set("date", dateOfMonth).set("month", month).set("hour", 5);

    if (date.isBefore(getDate())) {
        return date.set("year", date.get("year") + 1);
    }

    return date;
};

export const addIntervalToDate = (date: string | Date | Dayjs, interval: number, intervalUnit: ManipulateType) =>
    dayjs(date).add(interval, intervalUnit);

export const getDateWithCustomFormat = (date: string, format: string) => dayjs(date, format);

export const isDateBetween = (date: Dayjs, startDate: Dayjs, endDate: Dayjs) => date.isBetween(startDate, endDate);

export const getDateRange = (startDate: Dayjs, endDate: Dayjs) => {
    const dates = [];

    let currentDate = startDate;

    while (currentDate.isSameOrBefore(endDate)) {
        dates.push(currentDate);

        currentDate = currentDate.add(1, "day");
    }

    return dates;
};
