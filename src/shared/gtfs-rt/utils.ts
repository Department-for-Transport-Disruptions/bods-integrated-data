import { logger } from "@baselime/lambda-logger";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import { randomUUID } from "crypto";
import { ExtendedAvl } from "./types";
import { getDatabaseClient } from "../database";
import { getDate } from "../dates";

const { OccupancyStatus } = transit_realtime.VehiclePosition;
const ukNumberPlateRegex = new RegExp(
    /(^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$)|(^[A-Z][0-9]{1,3}[A-Z]{3}$)|(^[A-Z]{3}[0-9]{1,3}[A-Z]$)|(^[0-9]{1,4}[A-Z]{1,2}$)|(^[0-9]{1,3}[A-Z]{1,3}$)|(^[A-Z]{1,2}[0-9]{1,4}$)|(^[A-Z]{1,3}[0-9]{1,3}$)|(^[A-Z]{1,3}[0-9]{1,4}$)|(^[0-9]{3}[DX]{1}[0-9]{3}$)/,
);

export const getOccupancyStatus = (occupancy: string): transit_realtime.VehiclePosition.OccupancyStatus => {
    switch (occupancy) {
        case "full":
            return OccupancyStatus.FULL;
        case "seatsAvailable":
            return OccupancyStatus.MANY_SEATS_AVAILABLE;
        case "standingAvailable":
            return OccupancyStatus.STANDING_ROOM_ONLY;
        default:
            return OccupancyStatus.MANY_SEATS_AVAILABLE;
    }
};

export const mapAvlToGtfsEntity = (avl: ExtendedAvl): transit_realtime.IFeedEntity => {
    let routeId = "";
    let tripId = "";
    let startDate = null;
    let startTime = null;
    let scheduleRelationship = null;

    if (avl.route_id || avl.route_id === 0) {
        routeId = avl.route_id.toString();
        scheduleRelationship = transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED;

        if (avl.trip_id) {
            tripId = avl.trip_id;
        }

        if (avl.origin_aimed_departure_time) {
            const originAimedDepartureTime = getDate(avl.origin_aimed_departure_time);
            startDate = originAimedDepartureTime.format("YYYYMMDD");
            startTime = originAimedDepartureTime.format("HH:mm:ss");
        }
    }

    const isValidRegistrationNumber = ukNumberPlateRegex.test(avl.vehicle_ref.replace(/\s/g, ""));

    return {
        id: randomUUID(),
        vehicle: {
            occupancyStatus: avl.occupancy ? getOccupancyStatus(avl.occupancy) : null,
            position: {
                bearing: avl.bearing ? parseInt(avl.bearing) : 0,
                latitude: avl.latitude,
                longitude: avl.longitude,
            },
            vehicle: {
                id: avl.vehicle_ref,
                label: isValidRegistrationNumber ? avl.vehicle_ref : null,
            },
            trip: {
                routeId,
                tripId,
                startDate,
                startTime,
                scheduleRelationship,
            },
            timestamp: getDate(avl.recorded_at_time).unix(),
        },
    };
};

export const base64Encode = (data: Uint8Array) => Buffer.from(data).toString("base64");

/**
 * Get all AVL data from the database along with a route ID and trip ID for each AVL row.
 * The route ID is determined by looking up the route that matches the concatenation of the
 * AVL's operator and line refs with the concatenation of the route's national operator code
 * and short name. The trip ID is then determined by looking up the trip with this route ID
 * and that matches the trip's ticket machine journey code with the AVL's dated vehicle
 * journey ref, to ensure a single trip is matched. Note that it is possible for no matching
 * route ID or trip ID to be found.
 * @param dbClient The database client
 * @param routeIds Optional array of route IDs to filter on
 * @returns An array of AVL data enriched with route and trip IDs
 */
export const getAvlDataForGtfs = async (routeIds: string[]) => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const routesFilterClause = `WHERE routes_with_noc.route_id IN (${routeIds.join(",")})`;

        const queryResult = await sql<ExtendedAvl>`
            SELECT DISTINCT ON (avl.operator_ref, avl.vehicle_ref) avl.*, routes_with_noc.route_id AS route_id, trip.id as trip_id FROM avl
            LEFT OUTER JOIN (
                SELECT route.id AS route_id, CONCAT(agency.noc, route.route_short_name) AS concat_noc_route_short_name FROM route
                JOIN agency ON route.agency_id = agency.id
            ) routes_with_noc ON routes_with_noc.concat_noc_route_short_name = CONCAT(avl.operator_ref, avl.line_ref)
            LEFT OUTER JOIN trip ON trip.route_id = routes_with_noc.route_id AND trip.ticket_machine_journey_code = avl.dated_vehicle_journey_ref
            ${routeIds.length > 0 && routesFilterClause}
            ORDER BY avl.operator_ref, avl.vehicle_ref, avl.response_time_stamp DESC
        `.execute(dbClient);

        return queryResult.rows;
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem getting AVL data from the database", error);
        }

        throw error;
    } finally {
        await dbClient.destroy();
    }
};
