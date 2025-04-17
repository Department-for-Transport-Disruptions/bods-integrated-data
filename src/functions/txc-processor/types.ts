import { CalendarWithDates } from "@bods-integrated-data/shared/database";
import { JourneyPattern, VehicleJourney } from "@bods-integrated-data/shared/schema";

export type VehicleJourneyMapping = {
    vehicleJourney: VehicleJourney;
    routeId: number;
    serviceId: number;
    shapeId: string | null;
    tripId: string;
    blockId: string;
    serviceCode: string;
    journeyPattern?: JourneyPattern;
};

export type VehicleJourneyMappingWithCalendar = VehicleJourneyMapping & {
    calendarWithDates: CalendarWithDates;
};

export type VehicleJourneyMappingWithTimes = VehicleJourneyMappingWithCalendar & {
    startTime: string;
    endTime: string;
};
