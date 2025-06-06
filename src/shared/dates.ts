import dayjs, { extend as dayjsExtend, Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import weekday from "dayjs/plugin/weekday";
import { CalendarDateExceptionType, CalendarWithDates } from "./database";

export interface Event {
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
dayjsExtend(weekday);

dayjs.tz.setDefault("Europe/London");

export type DayJS = Dayjs;

export const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export const getDate = (input?: Parameters<typeof dayjs.utc>[0]) => dayjs.utc(input);

export const getDateWithLocalTime = (input?: Parameters<typeof dayjs>[0]) => dayjs(input).local();

export const getDateFromUnix = (input: number) => dayjs.unix(input);

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

export const getDateWithCustomFormat = (date: string, format: string) => dayjs.utc(date, format);

export const isDateBetween = (date: Dayjs, startDate: Dayjs, endDate: Dayjs) =>
    date.isBetween(startDate, endDate, "day", "[]");

export const isDateAfter = (date: Dayjs, dateToCompare: Dayjs) => date.isSameOrAfter(dateToCompare);

export const getDuration = (duration: string) => dayjs.duration(duration);

export const getDurationInSeconds = (duration: number) => dayjs.duration(duration, "seconds");

export const getLocalTime = (time: string) => dayjs(time, "HH:mm:ss").local();

/**
 * Gets an array of dates between a given start and end date, if the end date
 * is more than 9 months in the future then it is capped
 *
 * @param startDate
 * @param endDate
 * @returns Array of dates in range
 */
export const getDatesInRange = (startDate: Dayjs, endDate: Dayjs) => {
    const dates = [];

    let iteratorDate = startDate;
    const dateIn9Months = getDate().add(9, "months");

    while (iteratorDate.isSameOrBefore(endDate) && iteratorDate.isSameOrBefore(dateIn9Months)) {
        dates.push(iteratorDate);

        iteratorDate = iteratorDate.add(1, "day");
    }

    return dates;
};

export const checkCalendarsOverlap = (calendarWithDatesA: CalendarWithDates, calendarWithDatesB: CalendarWithDates) => {
    const { calendar: calendarA, calendarDates: calendarDatesA } = calendarWithDatesA;
    const { calendar: calendarB, calendarDates: calendarDatesB } = calendarWithDatesB;

    const dateRangesOverlap = calendarA.start_date <= calendarB.end_date && calendarA.end_date >= calendarB.start_date;

    if (!dateRangesOverlap) {
        return false;
    }

    let daysOfWeekOverlap = false;

    for (const day of daysOfWeek) {
        if (calendarA[day] === 1 && calendarB[day] === 1) {
            daysOfWeekOverlap = true;
            break;
        }
    }

    const calendarDatesOverlap = calendarDatesA.some((calendarDateA) =>
        calendarDatesB.some(
            (calendarDateB) =>
                calendarDateA.date === calendarDateB.date &&
                calendarDateA.exception_type === CalendarDateExceptionType.ServiceAdded &&
                calendarDateB.exception_type === CalendarDateExceptionType.ServiceAdded,
        ),
    );

    return daysOfWeekOverlap || calendarDatesOverlap;
};

export const getTflOriginAimedDepartureTime = (originAimedDepartureTime: number) =>
    getDateWithLocalTime().startOf("day").add(originAimedDepartureTime, "seconds").toISOString();

export type BankHoliday = {
    name: string;
    date: Dayjs;
};

export const getBankHolidaysList = (bankHolidaysJson: BankHolidaysJson): BankHoliday[] => {
    const { getNextOccurrenceOfBankHoliday } = createBankHolidayFunctions(bankHolidaysJson);

    return [
        { name: "StAndrewsDay", date: getNextOccurrenceOfDate(30, 10) },
        { name: "ChristmasEve", date: getNextOccurrenceOfDate(24, 11) },
        { name: "ChristmasDay", date: getNextOccurrenceOfDate(25, 11) },
        { name: "BoxingDay", date: getNextOccurrenceOfDate(26, 11) },
        { name: "NewYearsEve", date: getNextOccurrenceOfDate(31, 11) },
        { name: "NewYearsDay", date: getNextOccurrenceOfDate(1, 0) },
        { name: "Jan2ndScotland", date: getNextOccurrenceOfDate(2, 0) },
        { name: "AugustBankHolidayScotland", date: getNextOccurrenceOfBankHoliday("Scotland Summer bank holiday") },
        { name: "BoxingDayHoliday", date: getNextOccurrenceOfBankHoliday("Boxing Day") },
        { name: "ChristmasDayHoliday", date: getNextOccurrenceOfBankHoliday("Christmas Day") },
        { name: "EasterMonday", date: getNextOccurrenceOfBankHoliday("Easter Monday") },
        { name: "GoodFriday", date: getNextOccurrenceOfBankHoliday("Good Friday") },
        { name: "Jan2ndScotlandHoliday", date: getNextOccurrenceOfBankHoliday("2nd January") },
        { name: "LateSummerBankHolidayNotScotland", date: getNextOccurrenceOfBankHoliday("Summer bank holiday") },
        { name: "MayDay", date: getNextOccurrenceOfBankHoliday("Early May bank holiday") },
        { name: "NewYearsDayHoliday", date: getNextOccurrenceOfBankHoliday("New Year’s Day") },
        { name: "SpringBank", date: getNextOccurrenceOfBankHoliday("Spring bank holiday") },
        { name: "StAndrewsDayHoliday", date: getNextOccurrenceOfBankHoliday("St Andrew’s Day") },
    ];
};
