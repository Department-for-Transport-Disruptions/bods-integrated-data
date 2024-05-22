import { TflVehicleLocation } from "@bods-integrated-data/shared/schema";

export type TflApiKeys = {
    general_api_key: string;
    live_vehicles_api_key: string;
};

export type RealTimeVehicleLocationsApiResponse = {
    lines: {
        lineId: string;
        vehicles: TflVehicleLocation[];
    }[];
};
