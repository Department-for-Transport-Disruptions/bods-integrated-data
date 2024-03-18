import { VehicleJourney } from "@bods-integrated-data/shared/schema";

export type VehicleJourneyMapping = {
    vehicleJourney: VehicleJourney;
    serviceId: string;
    routeId: string;
};
