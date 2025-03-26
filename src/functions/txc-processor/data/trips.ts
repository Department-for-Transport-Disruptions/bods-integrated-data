import { KyselyDb, NewTrip } from "@bods-integrated-data/shared/database";
import { getLocalTime } from "@bods-integrated-data/shared/dates";
import { getDirectionRef } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { getWheelchairAccessibilityFromVehicleType, notEmpty } from "@bods-integrated-data/shared/utils";
import { hasher } from "node-object-hash";
import { VehicleJourneyMapping } from "../types";
import { insertTrips } from "./database";

export const processTrips = async (
    dbClient: KyselyDb,
    vehicleJourneyMappings: VehicleJourneyMapping[],
    filePath: string,
    mode?: string,
) => {
    const updatedVehicleJourneyMappings = structuredClone(vehicleJourneyMappings);

    const objectHasher = hasher();

    const trips = vehicleJourneyMappings
        .map<NewTrip | null>((vehicleJourneyMapping, index) => {
            const { vehicleJourney, journeyPattern } = vehicleJourneyMapping;

            const hashableData = {
                route_id: vehicleJourneyMapping.routeId,
                service_id: vehicleJourneyMapping.serviceId,
                block_id: vehicleJourney.Operational?.Block?.BlockNumber || "",
                trip_headsign: vehicleJourney.DestinationDisplay || journeyPattern?.DestinationDisplay || "",
                wheelchair_accessible: getWheelchairAccessibilityFromVehicleType(
                    vehicleJourney.Operational?.VehicleType,
                    mode,
                ),
                vehicle_journey_code: vehicleJourney.VehicleJourneyCode,
                ticket_machine_journey_code: vehicleJourney.Operational?.TicketMachine?.JourneyCode || "",
                direction: getDirectionRef(journeyPattern?.Direction),
                revision_number: vehicleJourney["@_RevisionNumber"],
                departure_time: getLocalTime(vehicleJourney.DepartureTime).utc().format("HH:mm:ssz"),
            };

            const hashedTripData = objectHasher.hash(hashableData, {
                alg: "sha1",
            });

            const tripId = `VJ${hashedTripData}`;

            updatedVehicleJourneyMappings[index].tripId = tripId;

            return {
                id: tripId,
                shape_id: vehicleJourneyMapping.shapeId,
                file_path: filePath,
                ...hashableData,
            };
        })
        .filter(notEmpty);

    if (trips.length > 0) {
        await insertTrips(dbClient, trips);
    }

    return updatedVehicleJourneyMappings;
};
