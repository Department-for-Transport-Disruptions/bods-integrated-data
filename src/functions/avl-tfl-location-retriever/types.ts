export type TflApiKeys = {
    general_api_key: string;
    live_vehicles_api_key: string;
};

export type RealTimeVehicleLocation = {
    producerRef?: string;
    vehicleRef?: string;
    vehicleName?: string;
    operatorRef?: string;
    monitored?: string;
    longitude?: number;
    latitude?: number;
    recordedAtTime?: string;
    bearing?: number;
    load?: number;
    passengerCount?: number;
    odometer?: number;
    headwayDeviation?: number;
    scheduleDeviation?: number;
    vehicleState?: number;
    nextStopPointId?: string;
    nextStopPointName?: string;
    previousStopPointId?: string;
    previousStopPointName?: string;
    lineRef?: string;
    publishedLineName?: string;
    directionRef?: number;
    originName?: string;
    originRef?: string;
    originAimedDepartureTime?: number;
    destinationName?: string;
    destinationRef?: string;
    vehicleJourneyRef?: string;
};

export type RealTimeVehicleLocationsApiResponse = {
    lines: {
        lineId: string;
        vehicles: RealTimeVehicleLocation[];
    }[];
};
