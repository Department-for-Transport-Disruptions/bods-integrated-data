import { NewCalendar, NewCalendarDate } from "@bods-integrated-data/shared/database";
import { getDate, getDateWithCustomFormat, isDateBetween } from "@bods-integrated-data/shared/dates";
import { OperatingPeriod, OperatingProfile, Service, VehicleJourney } from "@bods-integrated-data/shared/schema";
import type { Dayjs } from "dayjs";
import { ServiceExpiredError } from "./errors";

const formatCalendarDates = (
    days: string[],
    startDate: Dayjs,
    endDate: Dayjs,
    exceptionType: NewCalendarDate["exception_type"],
) =>
    days
        .filter((day) => isDateBetween(getDateWithCustomFormat(day, "YYYYMMDD"), startDate, endDate))
        .map(
            (day): NewCalendarDate => ({
                date: day,
                exception_type: exceptionType,
            }),
        ) ?? [];

const calculateDaysOfOperation = (
    day: OperatingProfile["RegularDayType"]["DaysOfWeek"],
    startDate: Dayjs,
    endDate: Dayjs,
): NewCalendar => {
    if (day === undefined) {
        throw new Error("Invalid operating profile");
    }

    const defaultAllDays = day === "";

    return {
        monday:
            defaultAllDays ||
            day.Monday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        tuesday:
            defaultAllDays ||
            day.Tuesday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        wednesday:
            defaultAllDays ||
            day.Wednesday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        thursday:
            defaultAllDays ||
            day.Thursday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        friday:
            defaultAllDays ||
            day.Friday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        saturday:
            defaultAllDays ||
            day.Saturday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.Weekend !== undefined
                ? 1
                : 0,
        sunday:
            defaultAllDays ||
            day.Sunday !== undefined ||
            day.NotSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.Weekend !== undefined
                ? 1
                : 0,
        start_date: startDate.format("YYYYMMDD"),
        end_date: endDate.format("YYYYMMDD"),
    };
};

export const formatCalendar = (
    operatingProfile: OperatingProfile,
    operatingPeriod: OperatingPeriod,
): {
    calendar: NewCalendar;
    calendarDates: NewCalendarDate[];
} => {
    const {
        RegularDayType: { DaysOfWeek: day, HolidaysOnly: holidaysOnly },
    } = operatingProfile;

    const currentDate = getDate();
    const startDate = getDateWithCustomFormat(operatingPeriod.StartDate, "YYYY-MM-DD");
    const endDate = operatingPeriod.EndDate ? getDateWithCustomFormat(operatingPeriod.EndDate, "YYYY-MM-DD") : null;

    if (endDate?.isBefore(currentDate)) {
        throw new ServiceExpiredError();
    }

    const startDateToUse = startDate.isBefore(currentDate) ? currentDate : startDate;
    const endDateToUse = endDate ?? startDateToUse.add(9, "months");

    const daysOfOperation = [
        ...(operatingProfile.BankHolidayOperation?.DaysOfOperation ?? []),
        ...(operatingProfile.SpecialDaysOperation?.DaysOfOperation?.DateRange.flat() ?? []),
    ];

    const daysOfNonOperation = [
        ...(operatingProfile.BankHolidayOperation?.DaysOfNonOperation ?? []),
        ...(operatingProfile.SpecialDaysOperation?.DaysOfNonOperation?.DateRange.flat() ?? []),
    ];

    const formattedExtraDaysOfOperation = formatCalendarDates(daysOfOperation, startDateToUse, endDateToUse, 1);
    const formattedExtraDaysOfNonOperation = formatCalendarDates(daysOfNonOperation, startDateToUse, endDateToUse, 2);

    if (holidaysOnly !== undefined) {
        return {
            calendar: {
                monday: 0,
                tuesday: 0,
                wednesday: 0,
                thursday: 0,
                friday: 0,
                saturday: 0,
                sunday: 0,
                start_date: startDateToUse.format("YYYYMMDD"),
                end_date: endDateToUse.format("YYYYMMDD"),
            },
            calendarDates: [...formattedExtraDaysOfOperation, ...formattedExtraDaysOfNonOperation],
        };
    }

    return {
        calendar: calculateDaysOfOperation(day, startDateToUse, endDateToUse),
        calendarDates: [...formattedExtraDaysOfOperation, ...formattedExtraDaysOfNonOperation],
    };
};

export const getOperatingProfile = (service: Service, vehicleJourney: VehicleJourney) => {
    const operatingPeriod = service.OperatingPeriod;
    const vehicleJourneyOperatingProfile = vehicleJourney.OperatingProfile;
    const serviceOperatingProfile = service.OperatingProfile;

    const operatingProfileToUse =
        vehicleJourneyOperatingProfile || serviceOperatingProfile || DEFAULT_OPERATING_PROFILE;

    return formatCalendar(operatingProfileToUse, operatingPeriod);
};

export const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
    RegularDayType: {
        DaysOfWeek: {
            MondayToSunday: "",
        },
    },
};
