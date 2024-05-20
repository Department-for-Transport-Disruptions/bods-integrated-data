import { logger } from "@baselime/lambda-logger";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import { randomUUID } from "crypto";
import { ExtendedAvl } from "./types";
import { Calendar, CalendarDateExceptionType, KyselyDb } from "../database";
import { getDate } from "../dates";

const { OccupancyStatus } = transit_realtime.VehiclePosition;
const ukNumberPlateRegex = new RegExp(
    /(^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$)|(^[A-Z][0-9]{1,3}[A-Z]{3}$)|(^[A-Z]{3}[0-9]{1,3}[A-Z]$)|(^[0-9]{1,4}[A-Z]{1,2}$)|(^[0-9]{1,3}[A-Z]{1,3}$)|(^[A-Z]{1,2}[0-9]{1,4}$)|(^[A-Z]{1,3}[0-9]{1,3}$)|(^[A-Z]{1,3}[0-9]{1,4}$)|(^[0-9]{3}[DX]{1}[0-9]{3}$)/,
);

const daysOfWeek: (keyof Calendar)[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
 * @param routeId Optional route ID or comma-separated route IDs to filter on
 * @param startTimeBefore Optional start time before to filter on using the AVL's departure time
 * @param startTimeAfter Optional start time after to filter on using the AVL's departure time
 * @param boundingBox Optional bounding box to filter on using the AVL's coordinates
 * @returns An array of AVL data enriched with route and trip IDs
 */
export const getAvlDataForGtfs = async (
    dbClient: KyselyDb,
    routeId?: string,
    startTimeBefore?: number,
    startTimeAfter?: number,
    boundingBox?: string,
) => {
    try {
        const currentDate = getDate().toISOString();
        const currentDay = daysOfWeek[getDate().day()];
        let query = dbClient
            .selectFrom("avl_bods")
            .distinctOn(["avl_bods.operator_ref", "avl_bods.vehicle_ref"])
            .leftJoin(
                (eb) =>
                    eb
                        .selectFrom("route")
                        .innerJoin("agency", "agency.id", "route.agency_id")
                        .select([
                            "route.id as route_id",
                            sql`CONCAT(agency.noc, route.route_short_name)`.as("concat_noc_route_short_name"),
                        ])
                        .as("routes_with_noc"),
                (join) =>
                    join.onRef(
                        "routes_with_noc.concat_noc_route_short_name",
                        "=",
                        sql`CONCAT(avl_bods.operator_ref, avl_bods.line_ref)`,
                    ),
            )
            .leftJoin("trip", (eb) =>
                eb
                    .onRef("trip.route_id", "=", "routes_with_noc.route_id")
                    .onRef("trip.ticket_machine_journey_code", "=", "avl_bods.dated_vehicle_journey_ref"),
            )
            .leftJoin("calendar", (eb) => eb.onRef("calendar.id", "=", "trip.service_id"))
            .leftJoin("calendar_date", (eb) =>
                eb
                    .onRef("calendar_date.service_id", "=", "trip.service_id")
                    .on("calendar_date.exception_type", "=", CalendarDateExceptionType.ServiceRemoved),
            )
            .leftJoin("stop_time", "stop_time.trip_id", "trip.id")
            .selectAll("avl_bods")
            .select(["routes_with_noc.route_id as route_id", "trip.id as trip_id"])
            .where("calendar.start_date", "<=", currentDate)
            .where("calendar.end_date", ">", currentDate)
            .where(`calendar.${currentDay}`, "=", 1)
            .where("calendar_date.exception_type", "is", null)
            .where("avl_bods.direction_ref", "=", "trip.direction")
            .where("avl_bods.origin_ref", "=", "stop_time.stop_id")
            .where("avl_bods.destination_ref", "=", "stop_time.destination_stop_id");

        if (routeId) {
            query = query.where(
                "routes_with_noc.route_id",
                "in",
                routeId.split(",").map((id) => Number(id)),
            );
        }

        if (startTimeBefore) {
            query = query.where("origin_aimed_departure_time", "<", sql<string>`to_timestamp(${startTimeBefore})`);
        }

        if (startTimeAfter) {
            query = query.where("origin_aimed_departure_time", ">", sql<string>`to_timestamp(${startTimeAfter})`);
        }

        if (boundingBox) {
            const [minX, minY, maxX, maxY] = boundingBox.split(",").map((coord) => Number(coord));
            const envelope = sql<string>`ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;
            query = query.where(dbClient.fn("ST_Within", ["geom", envelope]), "=", true);
        }

        query = query.orderBy(["avl_bods.operator_ref", "avl_bods.vehicle_ref", "avl_bods.response_time_stamp desc"]);

        return query.execute();
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem getting AVL data from the database", error);
        }

        throw error;
    }
};

export const generateGtfsRtFeed = (entities: transit_realtime.IFeedEntity[]) => {
    const message = {
        header: {
            gtfsRealtimeVersion: "2.0",
            incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
            timestamp: getDate().unix(),
        },
        entity: entities,
    };

    const feed = transit_realtime.FeedMessage.encode(message);
    const data = feed.finish();

    return data;
};
