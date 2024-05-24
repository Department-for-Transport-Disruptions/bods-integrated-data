import { logger } from "@baselime/lambda-logger";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import { randomUUID } from "crypto";
import { ExtendedAvl } from "./types";
import { mapAvlDateStrings } from "../avl/utils";
import { Calendar, CalendarDateExceptionType, KyselyDb } from "../database";
import { getDate } from "../dates";
import { DEFAULT_DATE_FORMAT } from "../schema/dates.schema";

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
 * Get all AVL data from the database using optional filters.
 * The route ID and trip ID for each AVL                                                                                                                                                                                                                                                                                                                                                                                                  are determined by a series of matching rules.
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
): Promise<ExtendedAvl[]> => {
    try {
        const currentDate = getDate();
        const currentDateIso = currentDate.toISOString();
        const currentDay = daysOfWeek[getDate().day()];

        let query = dbClient
            .with("matched_avl", (eb) =>
                eb
                    .selectFrom("avl_bods")
                    .innerJoin(
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
                            .onRef("trip.direction", "=", "avl_bods.direction_ref")
                            .onRef("trip.ticket_machine_journey_code", "=", "avl_bods.dated_vehicle_journey_ref"),
                    )
                    .leftJoin("calendar", "calendar.id", "trip.service_id")
                    .leftJoin("calendar_date", (eb) =>
                        eb
                            .onRef("calendar_date.service_id", "=", "trip.service_id")
                            .on("calendar_date.date", "=", currentDate.format(DEFAULT_DATE_FORMAT)),
                    )
                    .select([
                        "routes_with_noc.route_id",
                        "trip.id as trip_id",
                        "avl_bods.operator_ref",
                        "avl_bods.vehicle_ref",
                    ])
                    .where((eb) =>
                        eb.and([
                            eb("calendar.start_date", "<=", currentDateIso),
                            eb("calendar.end_date", ">", currentDateIso),
                            eb(`calendar.${currentDay}`, "=", 1),
                            eb.or([
                                eb("calendar_date.id", "is", null),
                                eb("calendar_date.exception_type", "=", CalendarDateExceptionType.ServiceAdded),
                            ]),
                        ]),
                    ),
            )
            .selectFrom("avl_bods")
            .distinctOn(["avl_bods.operator_ref", "avl_bods.vehicle_ref"])
            .leftJoin("matched_avl", (eb) =>
                eb
                    .onRef("matched_avl.operator_ref", "=", "avl_bods.operator_ref")
                    .onRef("matched_avl.vehicle_ref", "=", "avl_bods.vehicle_ref"),
            )
            .select(["route_id", "trip_id"])
            .selectAll("avl_bods")
            .where("avl_bods.valid_until_time", ">", sql<string>`NOW()`);

        if (routeId) {
            query = query.where(
                "route_id",
                "in",
                routeId.split(",").map((id) => Number(id)),
            );
        }

        if (startTimeBefore) {
            query = query.where(
                "avl_bods.origin_aimed_departure_time",
                "<",
                sql<string>`to_timestamp(${startTimeBefore})`,
            );
        }

        if (startTimeAfter) {
            query = query.where(
                "avl_bods.origin_aimed_departure_time",
                ">",
                sql<string>`to_timestamp(${startTimeAfter})`,
            );
        }

        if (boundingBox) {
            const [minX, minY, maxX, maxY] = boundingBox.split(",").map((coord) => Number(coord));
            const envelope = sql<string>`ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;
            query = query.where(dbClient.fn("ST_Within", ["geom", envelope]), "=", true);
        }

        query = query.orderBy(["avl_bods.operator_ref", "avl_bods.vehicle_ref", "avl_bods.response_time_stamp desc"]);

        const avls = await query.execute();

        return avls.map(mapAvlDateStrings);
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
