import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import { mapBodsAvlDateStrings } from "../avl/utils";
import { BodsAvl, Calendar, CalendarDateExceptionType, KyselyDb, NewAvl } from "../database";
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

    const operatorNocMap: Record<
        string,
        { getOperatorRef: (noc: string) => string; getLineRef: (lineRef: string) => string }
    > = {
        NT: {
            getOperatorRef: () => "NCTR",
            getLineRef: (lineRef) => lineRef.split("NT")[1],
        },
    };

    return operatorNocMap[avl.operator_ref]
        ? `${operatorNocMap[avl.operator_ref].getOperatorRef(avl.operator_ref)}_${operatorNocMap[
              avl.operator_ref
          ].getLineRef(avl.line_ref)}`
        : `${avl.operator_ref}_${avl.line_ref}`;
};

export const sanitiseTicketMachineJourneyCode = (input: string) => input.replace(":", "");

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
        ])
        .where((eb) =>
            eb.or([
                eb("calendar_date.exception_type", "=", CalendarDateExceptionType.ServiceAdded),
                eb.and([eb(`calendar.${currentDay}`, "=", 1), eb("calendar_date.exception_type", "is", null)]),
            ]),
        )
        .execute();
};

type MatchedTrips = Record<
    string,
    | {
          trip_id: string;
          revision: number;
          use: boolean;
      }
    | undefined
    | null
>;

// export const assignTripValueToLookup = (trips: MatchedTrips, tripKey: string) => {};

export const matchAvlToTimetables = async (dbClient: KyselyDb, avl: NewAvl[]) => {
    const timetableData = await retrieveMatchableTimetableData(dbClient);

    const lookup: {
        [key: string]: {
            noc: string;
            route_id: number;
            route_short_name: string;
            matchedTrips: MatchedTrips;
            matchedTripsWithOriginAndDestination: MatchedTrips;
        };
    } = {};

    for (const item of timetableData) {
        const routeKey = `${item.noc}_${item.route_short_name}`;
        const tripKey =
            item.direction && item.ticket_machine_journey_code
                ? `${item.direction}_${sanitiseTicketMachineJourneyCode(item.ticket_machine_journey_code)}`
                : null;

        const tripKeyWithOriginAndDestination =
            item.origin_stop_ref && item.destination_stop_ref
                ? `${tripKey}_${item.origin_stop_ref}_${item.destination_stop_ref}`
                : null;

        if (!lookup[routeKey]) {
            lookup[routeKey] = {
                noc: item.noc,
                route_id: item.route_id,
                route_short_name: item.route_short_name,
                matchedTrips: {},
                matchedTripsWithOriginAndDestination: {},
            };
        }

        const revision = item.revision_number && !Number.isNaN(item.revision_number) ? Number(item.revision_number) : 0;

        if (tripKey) {
            const tripValue = lookup[routeKey].matchedTrips[tripKey];

            if (tripValue === undefined) {
                lookup[routeKey].matchedTrips[tripKey] = {
                    trip_id: item.trip_id,
                    revision,
                    use: true,
                };
            } else if (tripValue) {
                if (!revision) {
                    lookup[routeKey].matchedTrips[tripKey] = null;
                } else if (revision > tripValue.revision) {
                    lookup[routeKey].matchedTrips[tripKey] = {
                        trip_id: item.trip_id,
                        revision,
                        use: true,
                    };
                } else if (revision === tripValue.revision) {
                    lookup[routeKey].matchedTrips[tripKey] = {
                        ...tripValue,
                        use: false,
                    };
                }
            }
        }

        if (tripKeyWithOriginAndDestination) {
            const tripValue = lookup[routeKey].matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination];

            if (tripValue === undefined) {
                lookup[routeKey].matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination] = {
                    trip_id: item.trip_id,
                    revision,
                    use: true,
                };
            } else if (tripValue) {
                if (!revision) {
                    lookup[routeKey].matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination] = null;
                } else if (revision > tripValue.revision) {
                    lookup[routeKey].matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination] = {
                        trip_id: item.trip_id,
                        revision,
                        use: true,
                    };
                } else if (revision === tripValue.revision) {
                    lookup[routeKey].matchedTripsWithOriginAndDestination[tripKeyWithOriginAndDestination] = {
                        ...tripValue,
                        use: false,
                    };
                }
            }
        }
    }

    let matchedAvlCount = 0;
    let totalAvlCount = 0;

    const enrichedAvl: NewAvl[] = avl.map((item) => {
        const routeKey = getRouteKey(item);
        const matchingRoute = routeKey ? lookup[routeKey] : null;

        let potentialMatchingTrip =
            matchingRoute && item.direction_ref && item.dated_vehicle_journey_ref
                ? matchingRoute.matchedTrips[
                      `${item.direction_ref}_${sanitiseTicketMachineJourneyCode(item.dated_vehicle_journey_ref)}`
                  ]
                : null;

        if (!potentialMatchingTrip || potentialMatchingTrip.use === false) {
            potentialMatchingTrip =
                matchingRoute &&
                item.direction_ref &&
                item.dated_vehicle_journey_ref &&
                item.origin_ref &&
                item.destination_ref
                    ? matchingRoute.matchedTripsWithOriginAndDestination[
                          `${item.direction_ref}_${sanitiseTicketMachineJourneyCode(item.dated_vehicle_journey_ref)}_${
                              item.origin_ref
                          }_${item.destination_ref}`
                      ]
                    : null;
        }

        const matchingTrip = potentialMatchingTrip?.use === true ? potentialMatchingTrip : null;

        if (matchingTrip) {
            matchedAvlCount++;
        }

        totalAvlCount++;

        return {
            ...item,
            route_id: matchingRoute?.route_id,
            trip_id: matchingTrip?.trip_id,
            geom:
                item.longitude && item.latitude
                    ? sql`ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)`
                    : null,
        };
    });

    return { avls: removeDuplicateAvls(enrichedAvl), matchedAvlCount: matchedAvlCount, totalAvlCount: totalAvlCount };
};
