import {
    CalendarDateExceptionType,
    Database,
    NewCalendar,
    NewCalendarDate,
} from "@bods-integrated-data/shared/database";
import { BankHolidaysJson, getDate, getDateWithCustomFormat, isDateBetween } from "@bods-integrated-data/shared/dates";
import { OperatingPeriod, OperatingProfile, Service, ServicedOrganisation } from "@bods-integrated-data/shared/schema";
import {
    DEFAULT_DATE_FORMAT,
    getTransformedBankHolidayOperationSchema,
} from "@bods-integrated-data/shared/schema/dates.schema";
import { Dayjs } from "dayjs";
import { Kysely } from "kysely";
import { insertCalendar } from "./database";
import { VehicleJourneyMapping } from "../types";

const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
    RegularDayType: {
        DaysOfWeek: {
            MondayToSunday: "",
        },
    },
};

export const formatCalendarDates = (
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
        );

export const calculateDaysOfOperation = (
    day: OperatingProfile["RegularDayType"]["DaysOfWeek"],
    startDate: Dayjs,
    endDate: Dayjs,
): NewCalendar => {
    if (day === undefined) {
        throw new Error("Invalid operating profile");
    }

    const formattedStartDate = startDate.format(DEFAULT_DATE_FORMAT);
    const formattedEndDate = endDate.format(DEFAULT_DATE_FORMAT);

    // In the case where <DaysOfWeek> is empty, default to empty calendar entry
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
            (day.Monday !== undefined ||
                day.MondayToFriday !== undefined ||
                day.MondayToSaturday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.NotTuesday !== undefined ||
                day.NotWednesday !== undefined ||
                day.NotThursday !== undefined ||
                day.NotFriday !== undefined ||
                day.NotSaturday !== undefined ||
                day.NotSunday !== undefined) &&
            day.NotMonday === undefined
                ? 1
                : 0,
        tuesday:
            (day.Tuesday !== undefined ||
                day.MondayToFriday !== undefined ||
                day.MondayToSaturday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.NotMonday !== undefined ||
                day.NotWednesday !== undefined ||
                day.NotThursday !== undefined ||
                day.NotFriday !== undefined ||
                day.NotSaturday !== undefined ||
                day.NotSunday !== undefined) &&
            day.NotTuesday === undefined
                ? 1
                : 0,
        wednesday:
            (day.Wednesday !== undefined ||
                day.MondayToFriday !== undefined ||
                day.MondayToSaturday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.NotMonday !== undefined ||
                day.NotTuesday !== undefined ||
                day.NotThursday !== undefined ||
                day.NotFriday !== undefined ||
                day.NotSaturday !== undefined ||
                day.NotSunday !== undefined) &&
            day.NotWednesday === undefined
                ? 1
                : 0,
        thursday:
            (day.Thursday !== undefined ||
                day.MondayToFriday !== undefined ||
                day.MondayToSaturday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.NotMonday !== undefined ||
                day.NotTuesday !== undefined ||
                day.NotWednesday !== undefined ||
                day.NotFriday !== undefined ||
                day.NotSaturday !== undefined ||
                day.NotSunday !== undefined) &&
            day.NotThursday === undefined
                ? 1
                : 0,
        friday:
            (day.Friday !== undefined ||
                day.MondayToFriday !== undefined ||
                day.MondayToSaturday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.NotMonday !== undefined ||
                day.NotTuesday !== undefined ||
                day.NotWednesday !== undefined ||
                day.NotThursday !== undefined ||
                day.NotSaturday !== undefined ||
                day.NotSunday !== undefined) &&
            day.NotFriday === undefined
                ? 1
                : 0,
        saturday:
            (day.Saturday !== undefined ||
                day.MondayToSaturday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.Weekend !== undefined ||
                day.NotMonday !== undefined ||
                day.NotTuesday !== undefined ||
                day.NotWednesday !== undefined ||
                day.NotThursday !== undefined ||
                day.NotFriday !== undefined ||
                day.NotSunday !== undefined) &&
            day.NotSaturday === undefined
                ? 1
                : 0,
        sunday:
            (day.Sunday !== undefined ||
                day.MondayToSunday !== undefined ||
                day.Weekend !== undefined ||
                day.NotMonday !== undefined ||
                day.NotTuesday !== undefined ||
                day.NotWednesday !== undefined ||
                day.NotThursday !== undefined ||
                day.NotFriday !== undefined ||
                day.NotSaturday !== undefined) &&
            day.NotSunday === undefined
                ? 1
                : 0,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
    };
};

export const calculateServicedOrgDaysToUse = (days: Dayjs[], calendar: NewCalendar) => {
    const calendarMap: Record<
        number,
        "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
    > = {
        0: "sunday",
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
    };

    /**
     * Determine which days in the serviced organisation date
     * ranges should be used based on the generated calendar
     */
    return days
        .filter((servicedOrgDay) => {
            const dayKey = calendarMap[servicedOrgDay.day()];

            return calendar[dayKey] === 1;
        })
        .map((servicedOrgDay) => servicedOrgDay.format(DEFAULT_DATE_FORMAT));
};

export const processServicedOrganisation = (
    servicedOrganisationDayType: OperatingProfile["ServicedOrganisationDayType"],
    servicedOrganisations: ServicedOrganisation[],
    calendar: NewCalendar,
) => {
    const servicedOrganisationWorkingDaysOperation =
        servicedOrganisations
            .find((org) =>
                org.OrganisationCode
                    ? servicedOrganisationDayType?.DaysOfOperation?.WorkingDays?.ServicedOrganisationRef.includes(
                          org.OrganisationCode,
                      )
                    : false,
            )
            ?.WorkingDays?.DateRange.flat() ?? [];

    const servicedOrganisationHolidaysOperation =
        servicedOrganisations
            .find((org) =>
                org.OrganisationCode
                    ? servicedOrganisationDayType?.DaysOfOperation?.Holidays?.ServicedOrganisationRef.includes(
                          org.OrganisationCode,
                      )
                    : false,
            )
            ?.Holidays?.DateRange.flat() ?? [];

    const servicedOrganisationWorkingDaysNonOperation =
        servicedOrganisations
            .find((org) =>
                org.OrganisationCode
                    ? servicedOrganisationDayType?.DaysOfNonOperation?.WorkingDays?.ServicedOrganisationRef.includes(
                          org.OrganisationCode,
                      )
                    : false,
            )
            ?.WorkingDays?.DateRange.flat() ?? [];

    const servicedOrganisationHolidaysNonOperation =
        servicedOrganisations
            .find((org) =>
                org.OrganisationCode
                    ? servicedOrganisationDayType?.DaysOfNonOperation?.Holidays?.ServicedOrganisationRef.includes(
                          org.OrganisationCode,
                      )
                    : false,
            )
            ?.Holidays?.DateRange.flat() ?? [];

    const servicedOrgDaysOfOperation = calculateServicedOrgDaysToUse(
        [...servicedOrganisationWorkingDaysOperation, ...servicedOrganisationHolidaysOperation],
        calendar,
    );

    const servicedOrgDaysOfNonOperation = calculateServicedOrgDaysToUse(
        [...servicedOrganisationWorkingDaysNonOperation, ...servicedOrganisationHolidaysNonOperation],
        calendar,
    );

    return {
        servicedOrgDaysOfOperation,
        servicedOrgDaysOfNonOperation,
    };
};

export const formatCalendar = (
    operatingProfile: OperatingProfile,
    operatingPeriod: OperatingPeriod,
    bankHolidaysJson: BankHolidaysJson,
    servicedOrganisations?: ServicedOrganisation[],
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

    const specialDaysOfOperation = operatingProfile.SpecialDaysOperation?.DaysOfOperation?.DateRange.flat() ?? [];
    const specialDaysOfNonOperation = operatingProfile.SpecialDaysOperation?.DaysOfNonOperation?.DateRange.flat() ?? [];
    const bankHolidayDaysOfOperation = operatingProfile.BankHolidayOperation?.DaysOfOperation;
    const bankHolidayDaysOfNonOperation = operatingProfile.BankHolidayOperation?.DaysOfNonOperation;

    const transformedbankHolidayDaysOfOperation = bankHolidayDaysOfOperation
        ? getTransformedBankHolidayOperationSchema(bankHolidaysJson, bankHolidayDaysOfOperation)
        : [];

    const transformedbankHolidayDaysOfNonOperation = bankHolidayDaysOfNonOperation
        ? getTransformedBankHolidayOperationSchema(bankHolidaysJson, bankHolidayDaysOfNonOperation)
        : [];

    const defaultCalendar: NewCalendar = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
        start_date: startDateToUse.format(DEFAULT_DATE_FORMAT),
        end_date: endDateToUse.format(DEFAULT_DATE_FORMAT),
    };

    let calendar = defaultCalendar;

    if (holidaysOnly === undefined) {
        calendar = calculateDaysOfOperation(day, startDateToUse, endDateToUse);
    }

    let servicedOrgDaysOfOperation: string[] = [];
    let servicedOrgDaysOfNonOperation: string[] = [];

    if (operatingProfile.ServicedOrganisationDayType !== undefined && servicedOrganisations !== undefined) {
        ({ servicedOrgDaysOfOperation, servicedOrgDaysOfNonOperation } = processServicedOrganisation(
            operatingProfile.ServicedOrganisationDayType,
            servicedOrganisations,
            calendar,
        ));

        calendar = defaultCalendar;
    }

    const daysOfNonOperation = [
        ...new Set([
            ...specialDaysOfNonOperation,
            ...transformedbankHolidayDaysOfNonOperation,
            ...servicedOrgDaysOfNonOperation,
        ]),
    ];
    const daysOfOperation = [
        ...new Set([
            ...specialDaysOfOperation,
            ...transformedbankHolidayDaysOfOperation,
            ...servicedOrgDaysOfOperation,
        ]),
    ].filter((day) => !daysOfNonOperation.includes(day));

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

    return {
        calendar,
        calendarDates: [...formattedExtraDaysOfOperation, ...formattedExtraDaysOfNonOperation],
    };
};

export const processCalendars = async (
    dbClient: Kysely<Database>,
    service: Service,
    vehicleJourneyMappings: VehicleJourneyMapping[],
    bankHolidaysJson: BankHolidaysJson,
    servicedOrganisations?: ServicedOrganisation[],
) => {
    let serviceCalendarId: number | null = null;

    if (service.OperatingProfile) {
        const serviceCalendar = await insertCalendar(
            dbClient,
            formatCalendar(service.OperatingProfile, service.OperatingPeriod, bankHolidaysJson, servicedOrganisations),
        );

        serviceCalendarId = serviceCalendar.id;
    }

    const updatedVehicleJourneyMappingsPromises = vehicleJourneyMappings.map(async (vehicleJourneyMapping) => {
        /**
         * If there is no vehicle journey level operating profile but there is a service level
         * operating profile, use the service level operating profile
         */
        if (!vehicleJourneyMapping.vehicleJourney.OperatingProfile && serviceCalendarId) {
            return {
                ...vehicleJourneyMapping,
                serviceId: serviceCalendarId,
            };
        }

        /**
         * If there is no vehicle journey level operating profile and no service level
         * operating profile, use DEFAULT_OPERATING_PROFILE
         */
        if (!vehicleJourneyMapping.vehicleJourney.OperatingProfile) {
            const defaultCalendar = await insertCalendar(
                dbClient,
                formatCalendar(
                    DEFAULT_OPERATING_PROFILE,
                    service.OperatingPeriod,
                    bankHolidaysJson,
                    servicedOrganisations,
                ),
            );

            return {
                ...vehicleJourneyMapping,
                serviceId: defaultCalendar.id,
            };
        }

        const calendarData = formatCalendar(
            vehicleJourneyMapping.vehicleJourney.OperatingProfile,
            service.OperatingPeriod,
            bankHolidaysJson,
            servicedOrganisations,
        );

        const calendar = await insertCalendar(dbClient, calendarData);

        return {
            ...vehicleJourneyMapping,
            serviceId: calendar.id,
        };
    });

    return Promise.all(updatedVehicleJourneyMappingsPromises);
};
