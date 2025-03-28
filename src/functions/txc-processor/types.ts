import { NewCalendar, NewCalendarDate } from "@bods-integrated-data/shared/database";
import { JourneyPattern, VehicleJourney } from "@bods-integrated-data/shared/schema";

export type VehicleJourneyMapping = {
    vehicleJourney: VehicleJourney;
    routeId: number;
    serviceId: number;
    shapeId: string | null;
    tripId: string;
    serviceCode: string;
    journeyPattern?: JourneyPattern;
};

export type CalendarWithDates = {
    calendar: NewCalendar;
    calendarDates: Omit<NewCalendarDate, "service_id">[];
};
