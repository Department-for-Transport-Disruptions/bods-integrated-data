import { KyselyDb, NewTrip } from "@bods-integrated-data/shared/database";
import { getLocalTime } from "@bods-integrated-data/shared/dates";
import { getDirectionRef } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { Service, VehicleJourney } from "@bods-integrated-data/shared/schema";
import { getWheelchairAccessibilityFromVehicleType, notEmpty } from "@bods-integrated-data/shared/utils";
import { hasher } from "node-object-hash";
import { VehicleJourneyMapping, VehicleJourneyMappingWithCalendar } from "../types";
import { insertTrips } from "./database";

export const processTrips = async (
    dbClient: KyselyDb,
    vehicleJourneyMappings: VehicleJourneyMapping[],
    filePath: string,
    revisionNumber: string,
    service?: Service,
): Promise<VehicleJourneyMappingWithCalendar[]> => {
    let updatedVehicleJourneyMappings = structuredClone(vehicleJourneyMappings) as VehicleJourneyMappingWithCalendar[];

    const objectHasher = hasher();

    const ignoredHashProperties: (keyof VehicleJourney)[] = ["DepartureDayShift"];

    const trips = vehicleJourneyMappings
        .map<NewTrip | null>((vehicleJourneyMapping, index) => {
            const { vehicleJourney, journeyPattern } = vehicleJourneyMapping;

            const clonedVehicleJourney = structuredClone(vehicleJourney);

            for (const property of ignoredHashProperties) {
                if (property in clonedVehicleJourney) {
                    delete clonedVehicleJourney[property];
                }
            }

            const hashedVehicleJourney = objectHasher.hash(
                { vehicleJourney: clonedVehicleJourney, service },
                {
                    alg: "sha1",
                },
            );

            const tripId = `VJ${hashedVehicleJourney}`;

            const blockNumber = vehicleJourney.Operational?.Block?.BlockNumber;

            updatedVehicleJourneyMappings[index].tripId = tripId;

            updatedVehicleJourneyMappings[index].blockId =
                blockNumber && (vehicleJourney.OperatingProfile || service?.OperatingProfile)
                    ? objectHasher.hash(
                          {
                              filePath: filePath.split(/\/(.*)/s)[1],
                              blockNumber,
                              operatingProfile: vehicleJourney.OperatingProfile || service?.OperatingProfile,
                          },
                          { alg: "sha1" },
                      )
                    : "";

            return {
                id: tripId,
                shape_id: vehicleJourneyMapping.shapeId,
                service_id: vehicleJourneyMapping.serviceId,
                file_path: filePath,
                route_id: vehicleJourneyMapping.routeId,
                block_id: "",
                trip_headsign: vehicleJourney.DestinationDisplay || journeyPattern?.DestinationDisplay || "",
                wheelchair_accessible: getWheelchairAccessibilityFromVehicleType(
                    vehicleJourney.Operational?.VehicleType,
                    service?.Mode,
                ),
                vehicle_journey_code: vehicleJourney.VehicleJourneyCode,
                ticket_machine_journey_code: vehicleJourney.Operational?.TicketMachine?.JourneyCode || "",
                direction: getDirectionRef(journeyPattern?.Direction),
                revision_number: revisionNumber,
                departure_time: getLocalTime(vehicleJourney.DepartureTime).utc().format("HH:mm:ssz"),
                departure_day_shift: vehicleJourney.DepartureDayShift === 1,
            };
        })
        .filter(notEmpty);

    if (trips.length > 0) {
        const insertedTrips = await insertTrips(
            dbClient,
            trips.sort((a, b) => a.id.localeCompare(b.id)),
        );

        if (insertedTrips.length > 0) {
            updatedVehicleJourneyMappings = updatedVehicleJourneyMappings.reduce((acc, item) => {
                const matchingTrip = insertedTrips.find((trip) => trip.id === item.tripId);

                if (!matchingTrip?.conflicting_files || !matchingTrip.conflicting_files.length) {
                    acc.push(item);
                }

                return acc;
            }, [] as VehicleJourneyMappingWithCalendar[]);
        }
    }

    return updatedVehicleJourneyMappings;
};
