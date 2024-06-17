import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import { mapBodsAvlDateStrings } from "../avl/utils";
import tflMapping from "../data/tflRouteToNocMapping.json";
import { BodsAvl, Calendar, CalendarDateExceptionType, KyselyDb, NewAvl } from "../database";
import { getDate, getDateWithCustomFormat } from "../dates";
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

export const mapAvlToGtfsEntity = (avl: NewAvl): transit_realtime.IFeedEntity => {
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
                bearing: avl.bearing ? Number.parseInt(avl.bearing) : 0,
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
): Promise<BodsAvl[]> => {
    try {
        let query = dbClient
            .selectFrom("avl_bods")
            .distinctOn(["vehicle_ref", "operator_ref"])
            .where("avl_bods.valid_until_time", ">", sql<string>`NOW()`)
            .selectAll("avl_bods");

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

        query = query.orderBy(["avl_bods.vehicle_ref", "avl_bods.operator_ref", "avl_bods.response_time_stamp desc"]);

        const avls = await query.execute();

        return avls.map(mapBodsAvlDateStrings);
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem getting AVL data from the database", error);
        }

        throw error;
    }
};

/**
 * Removes duplicates from an array of AVLs based on the trip ID. AVLs with missing trip IDs are ignored.
 * @param avls Array of AVLs
 * @returns Unique array of AVLs
 */
export const removeDuplicateAvls = (avls: NewAvl[]): NewAvl[] => {
    const avlsWithTripIdsDictionary: Record<string, NewAvl & { delete?: boolean }> = {};
    const avlsWithoutTripIds: NewAvl[] = [];

    for (const avl of avls) {
        if (avl.trip_id) {
            if (avlsWithTripIdsDictionary[avl.trip_id]) {
                avlsWithTripIdsDictionary[avl.trip_id].delete = true;
            } else {
                avlsWithTripIdsDictionary[avl.trip_id] = avl;
            }
        } else {
            avlsWithoutTripIds.push(avl);
        }
    }

    const avlsWithTripIds = Object.values(avlsWithTripIdsDictionary).filter((avl) => !avl.delete);

    return [...avlsWithTripIds, ...avlsWithoutTripIds];
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

/**
 * Get route key for matching lookup, accounting for any special operator rules
 *
 * @param avl
 * @returns Route key for given AVL item
 */
export const getRouteKey = (avl: NewAvl) => {
    if (!avl.operator_ref || !avl.line_ref) {
        return null;
    }

    let operatorRef = avl.operator_ref;
    let lineRef = avl.line_ref;

    if (operatorRef === "TFLO" && avl.published_line_name) {
        operatorRef = tflMapping[avl.published_line_name as keyof typeof tflMapping] ?? operatorRef;
        lineRef = avl.published_line_name;
    }

    const operatorNocMap: Record<
        string,
        { getOperatorRef: (noc: string) => string; getLineRef: (lineRef: string) => string }
    > = {
        NT: {
            getOperatorRef: () => "NCTR",
            getLineRef: (lineRef) => lineRef.split("NT")[1],
        },
    };

    return operatorNocMap[operatorRef]
        ? `${operatorNocMap[operatorRef].getOperatorRef(operatorRef)}_${operatorNocMap[operatorRef].getLineRef(
              lineRef,
          )}`
        : `${operatorRef}_${lineRef}`;
};

export const sanitiseTicketMachineJourneyCode = (input: string) => input.replace(":", "");

export const getDirectionRef = (direction: string) => {
    if (direction === "1") {
        return "outbound";
    }

    if (direction === "2") {
        return "inbound";
    }

    return direction;
};

export const retrieveMatchableTimetableData = async (dbClient: KyselyDb) => {
    const currentDate = getDate();
    const currentDateIso = currentDate.toISOString();
    const currentDay = daysOfWeek[getDate().day()];

    return await dbClient
        .selectFrom("agency")
        .innerJoin("route", "route.agency_id", "agency.id")
        .innerJoin("trip", "trip.route_id", "route.id")
        .innerJoin("calendar", (join) =>
            join
                .onRef("calendar.id", "=", "trip.service_id")
                .on("calendar.start_date", "<=", currentDateIso)
                .on("calendar.end_date", ">", currentDateIso),
        )
        .leftJoin("calendar_date", (join) =>
            join
                .onRef("calendar_date.service_id", "=", "trip.service_id")
                .on("calendar_date.date", "=", currentDate.format(DEFAULT_DATE_FORMAT)),
        )
        .select([
            "agency.noc",
            "route.id as route_id",
            "route.route_short_name",
            "trip.id as trip_id",
            "trip.ticket_machine_journey_code",
            "trip.direction",
            "trip.revision_number",
            "trip.origin_stop_ref",
            "trip.destination_stop_ref",
            "trip.departure_time",
        ])
        .where((eb) =>
            eb.or([
                eb("calendar_date.exception_type", "=", CalendarDateExceptionType.ServiceAdded),
                eb.and([eb(`calendar.${currentDay}`, "=", 1), eb("calendar_date.exception_type", "is", null)]),
            ]),
        )
        .execute();
};

type MatchingTimetable = Awaited<ReturnType<typeof retrieveMatchableTimetableData>>[0];

type MatchedTrip = {
    route_id: number;
    trip_id: string;
    revision: number;
    use: boolean;
};

type MatchedTrips = Record<string, MatchedTrip | undefined | null>;

export const assignTripValueToLookup = (
    tripValue: MatchedTrip | null | undefined,
    timetable: MatchingTimetable,
    revision: number,
    routeId: number,
) => {
    if (tripValue === undefined) {
        return {
            route_id: routeId,
            trip_id: timetable.trip_id,
            revision,
            use: true,
        };
    }

    if (tripValue) {
        if (!revision) {
            return null;
        }

        if (revision > tripValue.revision) {
            return {
                route_id: routeId,
                trip_id: timetable.trip_id,
                revision,
                use: true,
            };
        }

        if (revision === tripValue.revision) {
            return {
                ...tripValue,
                use: false,
            };
        }
    }

    return tripValue;
};

const createTimetableMatchingLookup = (timetableData: MatchingTimetable[]) => {
    const matchedTrips: MatchedTrips = {};
    const matchedTripsWithOriginAndDestination: MatchedTrips = {};
    const matchedTripsWithDepartureTime: MatchedTrips = {};

    for (const item of timetableData) {
        const routeKey = `${item.noc}_${item.route_short_name}`;

        const tripKey =
            item.direction && item.ticket_machine_journey_code
                ? `${routeKey}_${item.direction}_${sanitiseTicketMachineJourneyCode(item.ticket_machine_journey_code)}`
                : null;

        const tripKeyWithOriginAndDestination =
            item.origin_stop_ref && item.destination_stop_ref
                ? `${tripKey}_${item.origin_stop_ref}_${item.destination_stop_ref}`
                : null;

        const tripKeyWithDepartureTime =
            item.direction && item.origin_stop_ref && item.destination_stop_ref && item.departure_time
                ? `${routeKey}_${item.direction}_${item.origin_stop_ref}_${
                      item.destination_stop_ref
                  }_${getDateWithCustomFormat(item.departure_time, "HH:mm:ssZZ").format("HHmmss")}`
                : null;

        const revision = item.revision_number && !Number.isNaN(item.revision_number) ? Number(item.revision_number) : 0;

        if (tripKey) {
            matchedTrips[tripKey] = assignTripValueToLookup(matchedTrips[tripKey], item, revision, item.route_id);
        }

        if (tripKeyWithOriginAndDestination) {
            matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination] = assignTripValueToLookup(
                matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination],
                item,
                revision,
                item.route_id,
            );
        }

        if (tripKeyWithDepartureTime) {
            matchedTripsWithDepartureTime[tripKeyWithDepartureTime] = assignTripValueToLookup(
                matchedTripsWithDepartureTime[tripKeyWithDepartureTime],
                item,
                revision,
                item.route_id,
            );
        }
    }

    return {
        matchedTrips,
        matchedTripsWithOriginAndDestination,
        matchedTripsWithDepartureTime,
    };
};

/**
 * Attempts to match the AVL data to timetable data to obtain a route_id and trip_id. This is done
 * by creating a lookup map containing the timetable data with route and trip keys. The process is as follows:
 *
 * 1. Create a route key of the form `${operator_ref}_${line_ref}`
 * 2. Create a map of trips with a key of the form `${route_key}_${direction_ref}_${journey_code}`
 *      a. If a duplicate trip is found, check if there is a revision with a higher value and use that
 *      b. If there is no revision for any of the duplicate trips or the highest revision number is duplicated then
 *         return no match for this check
 * 3. Create a map of trips with a key of the form `${route_key}_${direction_ref}_${journey_code}_${origin_ref}_${destination_ref}`, this
 *    is used in case the above check still returns duplicate trips
 * 4. Create a map of trips with a key of the form `${route_key}_${direction_ref}_${origin_ref}_${destination_ref}_${departure_time}`, this
 *    is used in case the above check still returns duplicate trips
 * 5. Cross reference the avl data against the lookup to see if there is a match
 *
 *
 * @param dbClient
 * @param avl
 * @returns Array of matched and unmatched AVL data and count of total and matched AVL
 */
export const matchAvlToTimetables = async (dbClient: KyselyDb, avl: NewAvl[]) => {
    const timetableData = await retrieveMatchableTimetableData(dbClient);
    const lookup = createTimetableMatchingLookup(timetableData);

    let matchedAvlCount = 0;
    let totalAvlCount = 0;

    const enrichedAvl: NewAvl[] = avl.map((item) => {
        const routeKey = getRouteKey(item);

        let matchingTrip: MatchedTrip | null = null;

        if (routeKey) {
            let potentialMatchingTrip =
                item.direction_ref && item.dated_vehicle_journey_ref
                    ? lookup.matchedTrips[
                          `${routeKey}_${item.direction_ref}_${sanitiseTicketMachineJourneyCode(
                              item.dated_vehicle_journey_ref,
                          )}`
                      ]
                    : null;

            if (!potentialMatchingTrip || potentialMatchingTrip.use === false) {
                potentialMatchingTrip =
                    item.direction_ref && item.dated_vehicle_journey_ref && item.origin_ref && item.destination_ref
                        ? lookup.matchedTripsWithOriginAndDestination[
                              `${routeKey}_${item.direction_ref}_${sanitiseTicketMachineJourneyCode(
                                  item.dated_vehicle_journey_ref,
                              )}_${item.origin_ref}_${item.destination_ref}`
                          ]
                        : null;
            }

            if (!potentialMatchingTrip || potentialMatchingTrip.use === false) {
                const departureTime = item.origin_aimed_departure_time
                    ? getDate(item.origin_aimed_departure_time).format("HHmmss")
                    : null;

                const directionRef = getDirectionRef(item.direction_ref);

                potentialMatchingTrip =
                    directionRef && item.origin_ref && item.destination_ref && departureTime
                        ? lookup.matchedTripsWithDepartureTime[
                              `${routeKey}_${directionRef}_${item.origin_ref}_${item.destination_ref}_${departureTime}`
                          ]
                        : null;
            }

            matchingTrip = potentialMatchingTrip?.use === true ? potentialMatchingTrip : null;
        }

        if (matchingTrip) {
            matchedAvlCount++;
        }

        totalAvlCount++;

        return {
            ...item,
            route_id: matchingTrip?.route_id,
            trip_id: matchingTrip?.trip_id,
            geom:
                item.longitude && item.latitude
                    ? sql`ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)`
                    : null,
        };
    });

    return { avls: removeDuplicateAvls(enrichedAvl), matchedAvlCount: matchedAvlCount, totalAvlCount: totalAvlCount };
};
