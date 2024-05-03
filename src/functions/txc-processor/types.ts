import { JourneyPattern, VehicleJourney } from "@bods-integrated-data/shared/schema";

export type VehicleJourneyMapping = {
    vehicleJourney: VehicleJourney;
    routeId: number;
    serviceId: number;
    shapeId: string;
    tripId: string;
    serviceCode: string;
    journeyPattern?: JourneyPattern;
};
