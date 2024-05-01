import { Database, Trip } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { Kysely, sql } from "kysely";

export type Query = {
    getQuery: () => string;
    fileName: string;
    forceQuote?: string[];
};

export const queryBuilder = (dbClient: Kysely<Database>): Query[] => [
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("agency")
                .select([
                    "agency.id as agency_id",
                    "agency.name as agency_name",
                    "agency.url as agency_url",
                    sql.lit<string>(`'Europe/London'`).as("agency_timezone"),
                    sql.lit<string>(`'EN'`).as("agency_lang"),
                    "agency.phone as agency_phone",
                    "agency.noc as agency_noc",
                ])
                .orderBy("agency_id asc");

            return query.compile().sql;
        },
        fileName: "agency",
        forceQuote: ["agency_name", "agency_url", "agency_noc", "agency_phone"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("stop")
                .select([
                    "id as stop_id",
                    "stop_code",
                    "stop_name",
                    "stop_lat",
                    "stop_lon",
                    "wheelchair_boarding",
                    "location_type",
                    "parent_station",
                    "platform_code",
                ]);

            return query.compile().sql;
        },
        fileName: "stops",
        forceQuote: ["stop_name"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("route")
                .select(["id as route_id", "agency_id", "route_short_name", "route_long_name", "route_type"])
                .orderBy("route_id asc");

            return query.compile().sql;
        },
        fileName: "routes",
        forceQuote: ["route_short_name"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("calendar")
                .select([
                    "id as service_id",
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                    "start_date",
                    "end_date",
                ])
                .where((eb) =>
                    eb.or([
                        eb("monday", "=", eb.lit(1)),
                        eb("tuesday", "=", eb.lit(1)),
                        eb("wednesday", "=", eb.lit(1)),
                        eb("thursday", "=", eb.lit(1)),
                        eb("friday", "=", eb.lit(1)),
                        eb("saturday", "=", eb.lit(1)),
                        eb("sunday", "=", eb.lit(1)),
                    ]),
                )
                .orderBy("service_id asc");

            return query.compile().sql;
        },
        fileName: "calendar",
    },
    {
        getQuery: () => {
            const query = dbClient.selectFrom("calendar_date").select(["service_id", "date", "exception_type"]);

            return query.compile().sql;
        },
        fileName: "calendar_dates",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("trip")
                .select([
                    "route_id",
                    "service_id",
                    "id as trip_id",
                    "trip_headsign",
                    "block_id",
                    "shape_id",
                    "wheelchair_accessible",
                    "vehicle_journey_code",
                ])
                .orderBy("route_id asc");

            return query.compile().sql;
        },
        fileName: "trips",
        forceQuote: ["trip_headsign", "vehicle_journey_code"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("shape")
                .select(["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence", "shape_dist_traveled"]);

            return query.compile().sql;
        },
        fileName: "shapes",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("frequency")
                .select(["trip_id", "start_time", "end_time", "headway_secs", "exact_times"]);

            return query.compile().sql;
        },
        fileName: "frequencies",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("calendar")
                .select(({ fn }) => [
                    sql.lit<string>(`'Bus Open Data Service (BODS)'`).as("feed_publisher_name"),
                    sql.lit<string>(`'https://www.bus-data.dft.gov.uk/'`).as("feed_publisher_url"),
                    sql.lit<string>(`'EN'`).as("feed_lang"),
                    fn.min("start_date").as("feed_start_date"),
                    fn.max("end_date").as("feed_end_date"),
                    sql.lit<string>(`'${getDate().format("YYYYMMDD_HHmmss")}'`).as("feed_version"),
                ]);

            return query.compile().sql;
        },
        fileName: "feed_info",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom("stop_time")
                .select([
                    "trip_id",
                    "arrival_time",
                    "departure_time",
                    "stop_id",
                    "stop_sequence",
                    "stop_headsign",
                    "pickup_type",
                    "drop_off_type",
                    "shape_dist_traveled",
                    "timepoint",
                ]);

            return query.compile().sql;
        },
        fileName: "stop_times",
    },
];

export const regionalQueryBuilder = (dbClient: Kysely<Database>, regionCode: string): Query[] => [
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("route", "route.id", "trip_region.route_id")
                .innerJoin("agency", "agency.id", "route.agency_id")
                .select([
                    "agency.id as agency_id",
                    "agency.name as agency_name",
                    "agency.url as agency_url",
                    sql.lit<string>(`'Europe/London'`).as("agency_timezone"),
                    sql.lit<string>(`'EN'`).as("agency_lang"),
                    "agency.phone as agency_phone",
                    "agency.noc as agency_noc",
                ])
                .distinct()
                .orderBy("agency_id asc");

            return query.compile().sql;
        },
        fileName: "agency",
        forceQuote: ["agency_name", "agency_url", "agency_noc", "agency_phone"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("stop_time", "stop_time.trip_id", "trip_region.id")
                .innerJoin("stop", "stop.id", "stop_time.stop_id")
                .select([
                    "stop.id as stop_id",
                    "stop.stop_code",
                    "stop.stop_name",
                    "stop.stop_lat",
                    "stop.stop_lon",
                    "stop.wheelchair_boarding",
                    "stop.location_type",
                    "stop.parent_station",
                    "stop.platform_code",
                ])
                .distinct();

            return query.compile().sql;
        },
        fileName: "stops",
        forceQuote: ["stop_name"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("route", "route.id", "trip_region.route_id")
                .select([
                    "route.id as route_id",
                    "route.agency_id",
                    "route.route_short_name",
                    "route.route_long_name",
                    "route.route_type",
                ])
                .distinct()
                .orderBy("route_id asc");

            return query.compile().sql;
        },
        fileName: "routes",
        forceQuote: ["route_short_name"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("calendar", "calendar.id", "trip_region.service_id")
                .select([
                    "calendar.id as service_id",
                    "calendar.monday",
                    "calendar.tuesday",
                    "calendar.wednesday",
                    "calendar.thursday",
                    "calendar.friday",
                    "calendar.saturday",
                    "calendar.sunday",
                    "calendar.start_date",
                    "calendar.end_date",
                ])
                .distinct()
                .where((eb) =>
                    eb.or([
                        eb("monday", "=", eb.lit(1)),
                        eb("tuesday", "=", eb.lit(1)),
                        eb("wednesday", "=", eb.lit(1)),
                        eb("thursday", "=", eb.lit(1)),
                        eb("friday", "=", eb.lit(1)),
                        eb("saturday", "=", eb.lit(1)),
                        eb("sunday", "=", eb.lit(1)),
                    ]),
                )
                .orderBy("service_id asc");

            return query.compile().sql;
        },
        fileName: "calendar",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("calendar_date", "calendar_date.service_id", "trip_region.service_id")
                .select(["calendar_date.service_id", "calendar_date.date", "calendar_date.exception_type"])
                .distinct();

            return query.compile().sql;
        },
        fileName: "calendar_dates",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .select([
                    "trip_region.route_id",
                    "trip_region.service_id",
                    "trip_region.id as trip_id",
                    "trip_region.trip_headsign",
                    "trip_region.block_id",
                    "trip_region.shape_id",
                    "trip_region.wheelchair_accessible",
                    "trip_region.vehicle_journey_code",
                ])
                .orderBy("trip_region.route_id asc");

            return query.compile().sql;
        },
        fileName: "trips",
        forceQuote: ["trip_headsign", "vehicle_journey_code"],
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("shape", "shape.shape_id", "trip_region.shape_id")
                .select([
                    "shape.shape_id",
                    "shape.shape_pt_lat",
                    "shape.shape_pt_lon",
                    "shape.shape_pt_sequence",
                    "shape.shape_dist_traveled",
                ])
                .distinct();

            return query.compile().sql;
        },
        fileName: "shapes",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("frequency", "frequency.trip_id", "trip_region.id")
                .select([
                    "frequency.trip_id",
                    "frequency.start_time",
                    "frequency.end_time",
                    "frequency.headway_secs",
                    "frequency.exact_times",
                ])
                .distinct();

            return query.compile().sql;
        },
        fileName: "frequencies",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("calendar", "calendar.id", "trip_region.service_id")
                .select(({ fn }) => [
                    sql.lit<string>(`'Bus Open Data Service (BODS)'`).as("feed_publisher_name"),
                    sql.lit<string>(`'https://www.bus-data.dft.gov.uk/'`).as("feed_publisher_url"),
                    sql.lit<string>(`'EN'`).as("feed_lang"),
                    fn.min("calendar.start_date").as("feed_start_date"),
                    fn.max("calendar.end_date").as("feed_end_date"),
                    sql.lit<string>(`'${getDate().format("YYYYMMDD_HHmmss")}'`).as("feed_version"),
                ])
                .distinct();

            return query.compile().sql;
        },
        fileName: "feed_info",
    },
    {
        getQuery: () => {
            const query = dbClient
                .selectFrom(sql<Trip>`${sql.table(`trip_${regionCode}`)}`.as(`trip_region`))
                .innerJoin("stop_time", "stop_time.trip_id", "trip_region.id")
                .select([
                    "stop_time.trip_id",
                    "stop_time.arrival_time",
                    "stop_time.departure_time",
                    "stop_time.stop_id",
                    "stop_time.stop_sequence",
                    "stop_time.stop_headsign",
                    "stop_time.pickup_type",
                    "stop_time.drop_off_type",
                    "stop_time.shape_dist_traveled",
                    "stop_time.timepoint",
                ])
                .distinct();

            return query.compile().sql;
        },
        fileName: "stop_times",
    },
];
