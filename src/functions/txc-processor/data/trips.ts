import { KyselyDb, NewTrip } from "@bods-integrated-data/shared/database";
import { notEmpty, getWheelchairAccessibilityFromVehicleType } from "@bods-integrated-data/shared/utils";
import { randomUUID } from "crypto";
import { insertTrips } from "./database";
import { VehicleJourneyMapping } from "../types";

export const processTrips = async (
    dbClient: KyselyDb,
    vehicleJourneyMappings: VehicleJourneyMapping[],
    filePath: string,
) => {
    const updatedVehicleJourneyMappings = structuredClone(vehicleJourneyMappings);

    const trips = vehicleJourneyMappings
        .map<NewTrip | null>((vehicleJourneyMapping, index) => {
            const { vehicleJourney, journeyPattern } = vehicleJourneyMapping;

            const tripId = randomUUID();
            updatedVehicleJourneyMappings[index].tripId = tripId;

            return {
                id: tripId,
                route_id: vehicleJourneyMapping.routeId,
                service_id: vehicleJourneyMapping.serviceId,
                block_id: vehicleJourney.Operational?.Block?.BlockNumber || "",
                shape_id: vehicleJourneyMapping.shapeId,
                trip_headsign: vehicleJourney.DestinationDisplay || journeyPattern?.DestinationDisplay || "",
                wheelchair_accessible: getWheelchairAccessibilityFromVehicleType(
                    vehicleJourney.Operational?.VehicleType,
                ),
                vehicle_journey_code: vehicleJourney.VehicleJourneyCode,
                ticket_machine_journey_code: vehicleJourney.Operational?.TicketMachine?.JourneyCode || "",
                file_path: filePath,
            };
        })
        .filter(notEmpty);

    if (trips.length > 0) {
        await insertTrips(dbClient, trips);
    }

    return updatedVehicleJourneyMappings;
};
