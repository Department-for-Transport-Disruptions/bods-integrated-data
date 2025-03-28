import { KyselyDb, NewTrip } from "@bods-integrated-data/shared/database";
import { getLocalTime } from "@bods-integrated-data/shared/dates";
import { getDirectionRef } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { Service } from "@bods-integrated-data/shared/schema";
import { getWheelchairAccessibilityFromVehicleType, notEmpty } from "@bods-integrated-data/shared/utils";
import { hasher } from "node-object-hash";
import { VehicleJourneyMapping } from "../types";
import { insertTrips } from "./database";

export const processTrips = async (
    dbClient: KyselyDb,
    vehicleJourneyMappings: VehicleJourneyMapping[],
    filePath: string,
    service?: Service,
) => {
    const updatedVehicleJourneyMappings = structuredClone(vehicleJourneyMappings);

    const objectHasher = hasher();

    const trips = vehicleJourneyMappings
        .map<NewTrip | null>((vehicleJourneyMapping, index) => {
            const { vehicleJourney, journeyPattern } = vehicleJourneyMapping;

            const hashedVehicleJourney = objectHasher.hash(
                { vehicleJourney, service },
                {
                    alg: "sha1",
                },
            );

            const tripId = `VJ${hashedVehicleJourney}`;

            updatedVehicleJourneyMappings[index].tripId = tripId;

            return {
                id: tripId,
                shape_id: vehicleJourneyMapping.shapeId,
                service_id: vehicleJourneyMapping.serviceId,
                file_path: filePath,
                route_id: vehicleJourneyMapping.routeId,
                block_id: vehicleJourney.Operational?.Block?.BlockNumber || "",
                trip_headsign: vehicleJourney.DestinationDisplay || journeyPattern?.DestinationDisplay || "",
                wheelchair_accessible: getWheelchairAccessibilityFromVehicleType(
                    vehicleJourney.Operational?.VehicleType,
                    service?.Mode,
                ),
                vehicle_journey_code: vehicleJourney.VehicleJourneyCode,
                ticket_machine_journey_code: vehicleJourney.Operational?.TicketMachine?.JourneyCode || "",
                direction: getDirectionRef(journeyPattern?.Direction),
                revision_number: vehicleJourney["@_RevisionNumber"],
                departure_time: getLocalTime(vehicleJourney.DepartureTime).utc().format("HH:mm:ssz"),
            };
        })
        .filter(notEmpty);

    if (trips.length > 0) {
        await insertTrips(
            dbClient,
            trips.sort((a, b) => a.id.localeCompare(b.id)),
        );
    }

    return updatedVehicleJourneyMappings;
};
