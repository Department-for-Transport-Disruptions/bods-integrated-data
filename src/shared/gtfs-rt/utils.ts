import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { mapBodsAvlFieldsIntoUsableFormats } from "../avl/utils";
import { DEFAULT_DATE_FORMAT } from "../constants";
import tflMapping from "../data/tflRouteToNocMapping.json";
import { Avl, CalendarDateExceptionType, KyselyDb, NewAvl } from "../database";
import { daysOfWeek, getDate, getDateWithCustomFormat } from "../dates";
import { getDynamoItem } from "../dynamo";
import { transit_realtime } from "../gtfs-realtime";
import { logger } from "../logger";
import { putS3Object } from "../s3";

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

export const mapAvlToGtfsEntity = (avl: Avl | NewAvl): transit_realtime.IFeedEntity => {
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
            occupancy_status: avl.occupancy ? getOccupancyStatus(avl.occupancy) : null,
            position: {
                bearing: avl.bearing,
                latitude: avl.latitude,
                longitude: avl.longitude,
            },
            vehicle: {
                id: avl.vehicle_ref,
                label: isValidRegistrationNumber ? avl.vehicle_ref : null,
            },
            trip: {
                route_id: routeId,
                trip_id: tripId,
                start_date: startDate,
                start_time: startTime,
                schedule_relationship: scheduleRelationship,
            },
            timestamp: getDate(avl.recorded_at_time).unix(),
        },
    };
};

export const base64Encode = (data: Uint8Array) => Buffer.from(data).toString("base64");

/**
 * Get all AVL data from the database using optional filters.
 * The route ID and trip ID for each AVL are determined by a series of matching rules.
 * @param dbClient The database client
 * @param routeId Optional route ID or comma-separated route IDs to filter on
 * @param startTimeBefore Optional start time before to filter on using the AVL's departure time
 * @param startTimeAfter Optional start time after to filter on using the AVL's departure time
 * @param boundingBox Optional bounding box to filter on using the AVL's coordinates
 * @returns An array of AVL data enriched with route and trip IDs
 */
export const getAvlDataForGtfs = async (
    dbClient: KyselyDb,
    routeId?: number[],
    startTimeBefore?: number,
    startTimeAfter?: number,
    boundingBox?: number[],
): Promise<Avl[]> => {
    try {
        let query = dbClient.selectFrom("avl").distinctOn(["vehicle_ref", "operator_ref"]).selectAll("avl");

        if (routeId) {
            query = query.where("route_id", "in", routeId);
        }

        if (startTimeBefore) {
            query = query.where("avl.origin_aimed_departure_time", "<", sql<string>`to_timestamp(${startTimeBefore})`);
        }

        if (startTimeAfter) {
            query = query.where("avl.origin_aimed_departure_time", ">", sql<string>`to_timestamp(${startTimeAfter})`);
        }

        if (boundingBox) {
            const [minX, minY, maxX, maxY] = boundingBox;
            const envelope = sql<string>`ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;
            query = query.where(dbClient.fn("ST_Within", ["geom", envelope]), "=", true);
        }

        query = query.orderBy(["avl.vehicle_ref", "avl.operator_ref", "avl.recorded_at_time desc"]);

        const avls = await query.execute();

        return avls.map(mapBodsAvlFieldsIntoUsableFormats);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem getting AVL data from the database");
        }

        throw e;
    }
};

export const generateGtfsRtFeed = (entities: transit_realtime.IFeedEntity[]): Uint8Array => {
    const message = {
        header: {
            gtfs_realtime_version: "2.0",
            incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
            timestamp: getDate().unix(),
        } satisfies transit_realtime.IFeedHeader,
        entity: entities,
    };

    const verifyError = transit_realtime.FeedMessage.verify(message);

    if (verifyError) {
        logger.error(`Error verifying GTFS-RT message: ${verifyError}`);
    }

    return transit_realtime.FeedMessage.encode(message).finish();
};

export const uploadGtfsRtToS3 = async (bucketName: string, filename: string, data: Uint8Array, saveJson?: boolean) => {
    logger.info(`Uploading GTFS-RT to S3 bucket ${bucketName}`);

    await putS3Object({
        Bucket: bucketName,
        Key: `${filename}.bin`,
        ContentType: "application/octet-stream",
        Body: data,
    });

    if (saveJson) {
        const decodedJson = transit_realtime.FeedMessage.decode(data);

        await putS3Object({
            Bucket: bucketName,
            Key: `${filename}.json`,
            ContentType: "application/json",
            Body: JSON.stringify(decodedJson),
        });
    }

    logger.info("GTFS-RT generated and uploaded to S3");
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

export const getDirectionRef = (direction?: string) => {
    if (direction === "1" || direction === "outbound" || direction === "clockwise") {
        return "0";
    }

    if (direction === "2" || direction === "inbound" || direction === "antiClockwise") {
        return "1";
    }

    return "";
};

export const retrieveMatchableTimetableData = async (dbClient: KyselyDb) => {
    const currentDate = getDate();
    const currentDay = daysOfWeek[getDate().day()];

    return await dbClient
        .selectFrom("agency")
        .innerJoin("route", "route.agency_id", "agency.id")
        .innerJoin("trip_ALL as trip", "trip.route_id", "route.id")
        .innerJoin("calendar", (join) =>
            join
                .onRef("calendar.id", "=", "trip.service_id")
                .on("calendar.start_date", "<=", currentDate.format(DEFAULT_DATE_FORMAT))
                .on("calendar.end_date", ">=", currentDate.format(DEFAULT_DATE_FORMAT)),
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

export type MatchingTimetable = Awaited<ReturnType<typeof retrieveMatchableTimetableData>>[0];

export type MatchedTrip = {
    route_key: string;
    route_id: number;
    trip_id: string;
    revision: number;
    use: boolean;
};

type MatchedTrips = Record<string, MatchedTrip | null>;

export type GtfsTripMap = {
    PK: string;
    SK: string;
    tripId: string;
    routeId: number;
    timeToExist: number;
};

const assignTripValueToLookup = (
    tripValue: MatchedTrip | null,
    timetable: MatchingTimetable,
    revision: number,
    routeId: number,
    routeKey: string,
): MatchedTrip | null => {
    if (tripValue === undefined) {
        return {
            route_key: routeKey,
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
                route_key: routeKey,
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
 * 5. Cross reference the avl data against the lookup to see if there is a match (wherever this function is used)
 */
export const createTimetableMatchingLookup = (timetableData: MatchingTimetable[]) => {
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
            tripKey && item.origin_stop_ref && item.destination_stop_ref
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
            matchedTrips[tripKey] = assignTripValueToLookup(
                matchedTrips[tripKey],
                item,
                revision,
                item.route_id,
                routeKey,
            );
        }

        if (tripKeyWithOriginAndDestination) {
            matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination] = assignTripValueToLookup(
                matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination],
                item,
                revision,
                item.route_id,
                routeKey,
            );
        }

        if (tripKeyWithDepartureTime) {
            matchedTripsWithDepartureTime[tripKeyWithDepartureTime] = assignTripValueToLookup(
                matchedTripsWithDepartureTime[tripKeyWithDepartureTime],
                item,
                revision,
                item.route_id,
                routeKey,
            );
        }
    }

    return {
        matchedTrips,
        matchedTripsWithOriginAndDestination,
        matchedTripsWithDepartureTime,
    };
};

export const addMatchingTripToAvl = async (tableName: string, avl: NewAvl): Promise<NewAvl> => {
    const directionRef = getDirectionRef(avl.direction_ref);

    if (!directionRef) {
        return avl;
    }

    let matchingTrip: GtfsTripMap | null = null;
    const routeKey = getRouteKey(avl);

    if (!routeKey) {
        return avl;
    }

    if (avl.dated_vehicle_journey_ref) {
        const sanitisedTicketMachineJourneyCode = sanitiseTicketMachineJourneyCode(avl.dated_vehicle_journey_ref);
        const tripKey = `${routeKey}_${directionRef}_${sanitisedTicketMachineJourneyCode}`;

        matchingTrip = await getDynamoItem<GtfsTripMap>(tableName, {
            PK: routeKey,
            SK: `${tripKey}#1`,
        });
    }

    if (!matchingTrip && avl.dated_vehicle_journey_ref && avl.origin_ref && avl.destination_ref) {
        const sanitisedTicketMachineJourneyCode = sanitiseTicketMachineJourneyCode(avl.dated_vehicle_journey_ref);
        const tripKey = `${routeKey}_${directionRef}_${sanitisedTicketMachineJourneyCode}_${avl.origin_ref}_${avl.destination_ref}`;

        matchingTrip = await getDynamoItem<GtfsTripMap>(tableName, {
            PK: routeKey,
            SK: `${tripKey}#2`,
        });
    }

    if (!matchingTrip && avl.origin_ref && avl.destination_ref && avl.origin_aimed_departure_time) {
        const departureTime = getDate(avl.origin_aimed_departure_time).format("HHmmss");
        const tripKey = `${routeKey}_${directionRef}_${avl.origin_ref}_${avl.destination_ref}_${departureTime}`;

        matchingTrip = await getDynamoItem<GtfsTripMap>(tableName, {
            PK: routeKey,
            SK: `${tripKey}#3`,
        });
    }

    if (!matchingTrip) {
        return avl;
    }

    return {
        ...avl,
        route_id: matchingTrip.routeId,
        trip_id: matchingTrip.tripId,
    };
};
