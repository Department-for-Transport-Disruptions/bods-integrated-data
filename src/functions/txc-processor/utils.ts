import { NewCalendar } from "@bods-integrated-data/shared";
import { OperatingPeriod, OperatingProfile } from "@bods-integrated-data/shared/schema";

export const formatCalendar = (operatingProfile: OperatingProfile, operatingPeriod: OperatingPeriod): NewCalendar => {
    const {
        RegularDayType: { DaysOfWeek: day },
    } = operatingProfile;

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
        startDate: operatingPeriod.StartDate,
        endDate: operatingPeriod.EndDate ?? null,
    };
};
