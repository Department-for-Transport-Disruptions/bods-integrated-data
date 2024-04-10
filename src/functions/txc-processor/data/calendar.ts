import {
    CalendarDateExceptionType,
    Database,
    NewCalendar,
    NewCalendarDate,
} from "@bods-integrated-data/shared/database";
import { getDate, getDateWithCustomFormat, isDateBetween } from "@bods-integrated-data/shared/dates";
import {
    OperatingPeriod,
    OperatingProfile,
    Service,
    ServicedOrganisation,
    VehicleJourney,
} from "@bods-integrated-data/shared/schema";
import { DEFAULT_DATE_FORMAT } from "@bods-integrated-data/shared/schema/dates.schema";
import { Dayjs } from "dayjs";
import { Kysely } from "kysely";
import { hasher } from "node-object-hash";
import { VehicleJourneyMapping } from "../types";

const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
    RegularDayType: {
        DaysOfWeek: {
            MondayToSunday: "",
        },
    },
};

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

const processServicedOrganisation = (
    servicedOrganisationDayType: OperatingProfile["ServicedOrganisationDayType"],
    servicedOrganisations: ServicedOrganisation[],
) => {
    const servicedOrganisation = servicedOrganisations.find(
        (org) =>
            org.OrganisationCode === servicedOrganisationDayType?.DaysOfOperation?.WorkingDays?.ServicedOrganisationRef,
    )?.WorkingDays;
    console.log(servicedOrganisations.flatMap((org) => org.WorkingDays?.DateRange).flat());

    return [[], []];
};

export const formatCalendar = (
    operatingProfile: OperatingProfile,
    operatingPeriod: OperatingPeriod,
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
    const bankHolidayDaysOfOperation =
        operatingProfile.BankHolidayOperation?.DaysOfOperation?.filter(
            (day) => !specialDaysOfNonOperation.includes(day),
        ) ?? [];
    const bankHolidayDaysOfNonOperation = operatingProfile.BankHolidayOperation?.DaysOfNonOperation ?? [];

    let daysOfOperation = [...new Set([...specialDaysOfOperation, ...bankHolidayDaysOfOperation])];
    let daysOfNonOperation = [...new Set([...specialDaysOfNonOperation, ...bankHolidayDaysOfNonOperation])];

    let calendar: NewCalendar = {
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

    if (holidaysOnly === undefined) {
        calendar = calculateDaysOfOperation(day, startDateToUse, endDateToUse);
    }

    if (operatingProfile.ServicedOrganisationDayType !== undefined && servicedOrganisations !== undefined) {
        [daysOfOperation, daysOfNonOperation] = processServicedOrganisation(
            operatingProfile.ServicedOrganisationDayType,
            servicedOrganisations,
        );
    }

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

export const getOperatingProfile = (service: Service, vehicleJourney: VehicleJourney) => {
    const operatingPeriod = service.OperatingPeriod;
    const vehicleJourneyOperatingProfile = vehicleJourney.OperatingProfile;
    const serviceOperatingProfile = service.OperatingProfile;

    const operatingProfileToUse =
        vehicleJourneyOperatingProfile || serviceOperatingProfile || DEFAULT_OPERATING_PROFILE;

    return formatCalendar(operatingProfileToUse, operatingPeriod);
};

export const processCalendars = async (
    dbClient: Kysely<Database>,
    service: Service,
    vehicleJourneyMappings: VehicleJourneyMapping[],
    servicedOrganisations?: ServicedOrganisation[],
) => {
    let serviceCalendarId: number | null = null;

    if (service.OperatingProfile) {
        const serviceCalendar = await insertCalendar(
            dbClient,
            formatCalendar(service.OperatingProfile, service.OperatingPeriod, servicedOrganisations),
        );

        serviceCalendarId = serviceCalendar.id;
    }

    const updatedVehicleJourneyMappingsPromises = vehicleJourneyMappings.map(async (vehicleJourneyMapping) => {
        if (!vehicleJourneyMapping.vehicleJourney.OperatingProfile && serviceCalendarId) {
            return {
                ...vehicleJourneyMapping,
                serviceId: serviceCalendarId,
            };
        }

        if (!vehicleJourneyMapping.vehicleJourney.OperatingProfile) {
            const defaultCalendar = await insertCalendar(
                dbClient,
                formatCalendar(DEFAULT_OPERATING_PROFILE, service.OperatingPeriod, servicedOrganisations),
            );

            return {
                ...vehicleJourneyMapping,
                serviceId: defaultCalendar.id,
            };
        }

        const calendarData = formatCalendar(
            vehicleJourneyMapping.vehicleJourney.OperatingProfile,
            service.OperatingPeriod,
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

export const insertCalendar = async (
    dbClient: Kysely<Database>,
    calendarData: {
        calendar: NewCalendar;
        calendarDates: NewCalendarDate[];
    },
) => {
    const calendarHash = hasher().hash(calendarData);

    const insertedCalendar = await dbClient
        .insertInto("calendar_new")
        .values({ ...calendarData.calendar, calendar_hash: calendarHash })
        .onConflict((oc) => oc.column("calendar_hash").doUpdateSet({ ...calendarData.calendar }))
        .returningAll()
        .executeTakeFirst();

    if (!insertedCalendar?.id) {
        throw new Error("Calendar failed to insert");
    }

    if (!calendarData.calendarDates?.length) {
        return insertedCalendar;
    }

    await dbClient
        .insertInto("calendar_date_new")
        .values(
            calendarData.calendarDates.map((date) => ({
                date: date.date,
                exception_type: date.exception_type,
                service_id: insertedCalendar.id,
            })),
        )
        .onConflict((oc) => oc.doNothing())
        .execute();

    return insertedCalendar;
};
