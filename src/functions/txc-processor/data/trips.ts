import { logger } from "@baselime/lambda-logger";
import { Database, Route, NewTrip } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { notEmpty, getWheelchairAccessibilityFromVehicleType } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { randomUUID } from "crypto";
import { insertTrips } from "./database";
import { VehicleJourneyMapping } from "../types";

export const processTrips = async (
    dbClient: Kysely<Database>,
    txcServices: Service[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
    routes: Route[],
    filePath: string,
) => {
    const updatedVehicleJourneyMappings = structuredClone(vehicleJourneyMappings);

    const trips = vehicleJourneyMappings
        .map<NewTrip | null>((vehicleJourneyMapping, index) => {
            const { vehicleJourney } = vehicleJourneyMapping;
            const route = routes.find((route) => route.line_id === vehicleJourney.LineRef);

            if (!route) {
                logger.warn(`Unable to find route with line ref: ${vehicleJourney.LineRef}`);
                return null;
            }

            const journeyPattern = txcServices
                .flatMap((s) => s.StandardService.JourneyPattern)
                .find((journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef);

            if (!journeyPattern) {
                logger.warn(
                    `Unable to find journey pattern with journey pattern ref: ${vehicleJourney.JourneyPatternRef}`,
                );
                return null;
            }

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

    await insertTrips(dbClient, trips);

    return updatedVehicleJourneyMappings;
};
