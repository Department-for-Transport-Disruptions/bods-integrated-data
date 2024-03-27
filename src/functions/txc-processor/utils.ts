import { logger } from "@baselime/lambda-logger";
import {
    CalendarDateExceptionType,
    DropOffType,
    NewCalendar,
    NewCalendarDate,
    NewStopTime,
    PickupType,
    Timepoint,
} from "@bods-integrated-data/shared/database";
import { getDate, getDateWithCustomFormat, getDuration, isDateBetween } from "@bods-integrated-data/shared/dates";
import {
    AbstractTimingLink,
    OperatingPeriod,
    OperatingProfile,
    Service,
    VehicleJourney,
} from "@bods-integrated-data/shared/schema";
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

export const getPickupTypeFromStopActivity = (activity?: string) => {
    switch (activity) {
        case "pickUp":
        case "pickUpAndSetDown":
            return PickupType.Pickup;
        case "setDown":
        case "pass":
            return PickupType.NoPickup;
        default:
            return PickupType.Pickup;
    }
};

export const getDropOffTypeFromStopActivity = (activity?: string) => {
    switch (activity) {
        case "setDown":
        case "pickUpAndSetDown":
            return DropOffType.DropOff;
        case "pickUp":
        case "pass":
            return DropOffType.NoDropOff;
        default:
            return DropOffType.DropOff;
    }
};

export const getTimepointFromTimingStatus = (timingStatus?: string) => {
    return timingStatus === "principalTimingPoint" ? Timepoint.Exact : Timepoint.Approximate;
};

/**
 * Maps journey pattern timing links to stop times and assumes the vehicle journey departure time as the
 * first stop's departure time. Where a journey pattern timing link property is not defined, its corresponding
 * property within the vehicle journey timing link is used, or a default value if neither are defined.
 * @param tripId Trip ID
 * @param vehicleJourney Associated vehicle journey
 * @param journeyPatternTimingLinks Journey pattern timing links
 * @returns An array of stop times
 */
export const mapTimingLinksToStopTimes = (
    tripId: string,
    vehicleJourney: VehicleJourney,
    journeyPatternTimingLinks: AbstractTimingLink[],
): NewStopTime[] => {
    let currentStopDepartureTime = getDateWithCustomFormat(vehicleJourney.DepartureTime, "HH:mm:ss");
    let sequenceNumber = 0;

    return journeyPatternTimingLinks.flatMap<NewStopTime>((journeyPatternTimingLink, index) => {
        const vehicleJourneyTimingLink = vehicleJourney.VehicleJourneyTimingLink?.find(
            (link) => link.JourneyPatternTimingLinkRef === journeyPatternTimingLink["@_id"],
        );

        const { runTime, stopTime } = mapTimingLinkToStopTime(
            "from",
            currentStopDepartureTime,
            tripId,
            sequenceNumber,
            journeyPatternTimingLink,
            vehicleJourneyTimingLink,
        );

        sequenceNumber++;

        if (runTime) {
            currentStopDepartureTime = currentStopDepartureTime.add(runTime);
        }

        const stopTimesToAdd: NewStopTime[] = [];

        if (stopTime) {
            stopTimesToAdd.push(stopTime);
        }

        if (index === journeyPatternTimingLinks.length - 1) {
            const { stopTime: finalStopTime } = mapTimingLinkToStopTime(
                "to",
                currentStopDepartureTime,
                tripId,
                sequenceNumber,
                journeyPatternTimingLink,
                vehicleJourneyTimingLink,
            );

            if (finalStopTime) {
                stopTimesToAdd.push(finalStopTime);
            }
        }

        return stopTimesToAdd;
    });
};

/**
 * Map a timing link to a stop time. Either the From or To stop usage activity is used depending on the `stopUsageType`.
 * If a run time will optionally be returned if it can be calculated.
 * @param stopUsageType Which stop usage to use (from or to)
 * @param currentStopDepartureTime Current stop departure time
 * @param tripId Trip ID
 * @param sequenceNumber Current sequence number
 * @param journeyPatternTimingLink Journey pattern timing link
 * @param vehicleJourneyTimingLink Vehicle journey timing link
 * @returns A stop time and optional run time
 */
export const mapTimingLinkToStopTime = (
    stopUsageType: "from" | "to",
    currentStopDepartureTime: Dayjs,
    tripId: string,
    sequenceNumber: number,
    journeyPatternTimingLink: AbstractTimingLink,
    vehicleJourneyTimingLink?: AbstractTimingLink,
): { runTime?: plugin.Duration; stopTime?: NewStopTime } => {
    const journeyPatternTimingLinkStopUsage =
        stopUsageType === "from" ? journeyPatternTimingLink?.From : journeyPatternTimingLink?.To;
    const vehicleJourneyTimingLinkStopUsage =
        stopUsageType === "from" ? vehicleJourneyTimingLink?.From : vehicleJourneyTimingLink?.To;

    const stopPointRef =
        journeyPatternTimingLinkStopUsage?.StopPointRef || vehicleJourneyTimingLinkStopUsage?.StopPointRef;

    if (!stopPointRef) {
        logger.warn(
            `Missing stop point ref for journey pattern timing link with ref: ${journeyPatternTimingLink["@_id"]}`,
        );
        return {};
    }

    const activity = journeyPatternTimingLinkStopUsage?.Activity || vehicleJourneyTimingLinkStopUsage?.Activity;
    const timingStatus =
        journeyPatternTimingLinkStopUsage?.TimingStatus || vehicleJourneyTimingLinkStopUsage?.TimingStatus;

    const arrivalTime = currentStopDepartureTime.clone();
    let departureTime = arrivalTime.clone();

    const waitTime = getFirstNonZeroDuration([
        journeyPatternTimingLinkStopUsage?.WaitTime,
        vehicleJourneyTimingLinkStopUsage?.WaitTime,
    ]);

    if (waitTime) {
        departureTime = departureTime.add(waitTime);
    }

    const runTime = getFirstNonZeroDuration([journeyPatternTimingLink.RunTime, vehicleJourneyTimingLink?.RunTime]);

    return {
        runTime,
        stopTime: {
            trip_id: tripId,
            stop_id: stopPointRef,
            arrival_time: arrivalTime.format("HH:mm:ss"),
            departure_time: departureTime.format("HH:mm:ss"),
            stop_sequence: sequenceNumber,
            stop_headsign: "",
            pickup_type: getPickupTypeFromStopActivity(activity),
            drop_off_type: getDropOffTypeFromStopActivity(activity),
            shape_dist_traveled: 0,
            timepoint: getTimepointFromTimingStatus(timingStatus),
        },
    };
};

/**
 * Iterates over an array of ISO 8601 durations and returns the first non-zero element as a duration object.
 * @param durationStrings Array of ISO 8601 durations
 * @returns The first non-zero duration, or undefined otherwise
 */
export const getFirstNonZeroDuration = (durationStrings: (string | undefined)[]) => {
    for (let i = 0; i < durationStrings.length; i++) {
        const durationString = durationStrings[i];

        if (durationString) {
            const duration = getDuration(durationString);

            if (duration.asSeconds() > 0) {
                return duration;
            }
        }
    }

    return undefined;
};
