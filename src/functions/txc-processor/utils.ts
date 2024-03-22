import { CalendarDateExceptionType, NewCalendar, NewCalendarDate } from "@bods-integrated-data/shared/database";
import { getDate, getDateWithCustomFormat, isDateBetween } from "@bods-integrated-data/shared/dates";
import { OperatingPeriod, OperatingProfile, Service, VehicleJourney } from "@bods-integrated-data/shared/schema";
import { DEFAULT_DATE_FORMAT } from "@bods-integrated-data/shared/schema/dates.schema";
import type { Dayjs } from "dayjs";

const formatCalendarDates = (
    days: string[],
    startDate: Dayjs,
    endDate: Dayjs,
    exceptionType: CalendarDateExceptionType,
) =>
    days
        .filter((day) => isDateBetween(getDateWithCustomFormat(day, DEFAULT_DATE_FORMAT), startDate, endDate))
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

    const formattedStartDate = startDate.format(DEFAULT_DATE_FORMAT);
    const formattedEndDate = endDate.format(DEFAULT_DATE_FORMAT);

    // In the case where <DaysOfWeek> is empty, default to the service not running on any day of the week
    if (day === "") {
        return {
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 0,
            start_date: formattedStartDate,
            end_date: formattedEndDate,
        };
    }

    return {
        monday:
            day.Monday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        tuesday:
            day.Tuesday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        wednesday:
            day.Wednesday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        thursday:
            day.Thursday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        friday:
            day.Friday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        saturday:
            day.Saturday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.Weekend !== undefined
                ? 1
                : 0,
        sunday:
            day.Sunday !== undefined ||
            day.NotSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.Weekend !== undefined
                ? 1
                : 0,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
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

    const formattedExtraDaysOfOperation = formatCalendarDates(
        daysOfOperation,
        startDateToUse,
        endDateToUse,
        CalendarDateExceptionType.ServiceAdded,
    );
    const formattedExtraDaysOfNonOperation = formatCalendarDates(
        daysOfNonOperation,
        startDateToUse,
        endDateToUse,
        CalendarDateExceptionType.ServiceRemoved,
    );

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
                start_date: startDateToUse.format(DEFAULT_DATE_FORMAT),
                end_date: endDateToUse.format(DEFAULT_DATE_FORMAT),
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

export const hasServiceExpired = (service: Service) => {
    const currentDate = getDate();
    const endDate = getDate(service.OperatingPeriod.EndDate);

    return endDate?.isBefore(currentDate, "day");
};

export const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
    RegularDayType: {
        DaysOfWeek: {
            MondayToSunday: "",
        },
    },
};
