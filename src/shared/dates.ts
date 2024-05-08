import dayjs, { extend as dayjsExtend, Dayjs, ManipulateType } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

interface Event {
    title: string;
    date: string;
    notes: string;
    bunting: boolean;
}

interface Division {
    division: string;
    events: Event[];
}

export interface BankHolidaysJson {
    "england-and-wales": Division;
    scotland: Division;
    "northern-ireland": Division;
}

dayjsExtend(duration);
dayjsExtend(timezone);
dayjsExtend(utc);
dayjsExtend(customParseFormat);
dayjsExtend(isSameOrAfter);
dayjsExtend(isSameOrBefore);
dayjsExtend(isBetween);

dayjs.tz.setDefault("Europe/London");

export const getDate = (input?: Parameters<typeof dayjs.utc>[0]) => dayjs.utc(input);

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

export function createBankHolidayFunctions(ukBankHolidays: BankHolidaysJson) {
    const mappedScottishHolidays = () =>
        [...ukBankHolidays.scotland.events].map((holiday) => {
            if (holiday.title === "Summer bank holiday") {
                return {
                    ...holiday,
                    title: "Scotland Summer bank holiday",
                };
            }
            return holiday;
        });

    const bankHolidays = () =>
        [...ukBankHolidays["england-and-wales"].events, ...mappedScottishHolidays()]
            .filter(
                (value, index, self) =>
                    index === self.findIndex((t) => t.date === value.date && t.title === value.title),
            )
            .sort((a, b) => a.date.localeCompare(b.date));

    const futureBankHolidays = () =>
        bankHolidays().slice(bankHolidays().findIndex((holiday) => dayjs(holiday.date).isSameOrAfter(dayjs())) - 1);

    const getNextOccurrenceOfBankHoliday = (bankHolidayName: string) => {
        const date = futureBankHolidays().find((holiday) => holiday.title.startsWith(bankHolidayName))?.date;
        if (!date) {
            throw new Error("Bank holiday not found");
        }
        return dayjs.utc(date);
    };

    return {
        getNextOccurrenceOfBankHoliday,
        bankHolidays, // This function lists all bank holidays considering mapped Scottish ones
        futureBankHolidays, // This function provides a list of future bank holidays based on the current date
    };
}

export const getNextOccurrenceOfDate = (dateOfMonth: number, month: number) => {
    const currentDate = dayjs.utc();
    const date = currentDate.set("date", dateOfMonth).set("month", month);

    if (date.isBefore(currentDate)) {
        return date.add(1, "year");
    }

    return date;
};

export const addIntervalToDate = (date: string | Date | Dayjs, interval: number, intervalUnit: ManipulateType) =>
    dayjs.utc(date).add(interval, intervalUnit);

export const getDateWithCustomFormat = (date: string, format: string) => dayjs.utc(date, format);

export const isDateBetween = (date: Dayjs, startDate: Dayjs, endDate: Dayjs) =>
    date.isBetween(startDate, endDate, "day", "[]");

export const getDuration = (duration: string) => dayjs.duration(duration);

export const getDateRange = (startDate: Dayjs, endDate: Dayjs) => {
    const dates = [];

    let currentDate = startDate;

    while (currentDate.isSameOrBefore(endDate)) {
        dates.push(currentDate);

        currentDate = currentDate.add(1, "day");
    }

    return dates;
};
