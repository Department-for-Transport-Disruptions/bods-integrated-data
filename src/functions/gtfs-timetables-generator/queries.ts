import { Database } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { Kysely, sql } from "kysely";

export type Query = {
    query: string;
    fileName: string;
    forceQuote?: string[];
};

export const queryBuilder = (dbClient: Kysely<Database>): Query[] => [
    {
        query: dbClient
            .selectFrom("agency_new")
            .select([
                "id as agency_id",
                "name as agency_name",
                "url as agency_url",
                sql.lit<string>(`'Europe/London'`).as("agency_timezone"),
                sql.lit<string>(`'EN'`).as("agency_lang"),
                "phone as agency_phone",
                "noc as agency_noc",
            ])
            .orderBy("agency_id asc")
            .compile().sql,
        fileName: "agency",
        forceQuote: ["agency_name", "agency_url", "agency_noc", "agency_phone"],
    },
    {
        query: dbClient
            .selectFrom("stop_new")
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
            ])
            .compile().sql,
        fileName: "stops",
        forceQuote: ["stop_name"],
    },
    {
        query: dbClient
            .selectFrom("route_new")
            .select(["id as route_id", "agency_id", "route_short_name", "route_long_name", "route_type"])
            .orderBy("route_id asc")
            .compile().sql,
        fileName: "routes",
        forceQuote: ["route_short_name"],
    },
    {
        query: dbClient
            .selectFrom("calendar_new")
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
            .orderBy("service_id asc")
            .compile().sql,
        fileName: "calendar",
    },
    {
        query: dbClient.selectFrom("calendar_date_new").select(["service_id", "date", "exception_type"]).compile().sql,
        fileName: "calendar_dates",
    },
    {
        query: dbClient
            .selectFrom("trip_new")
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
            .orderBy("route_id asc")
            .compile().sql,
        fileName: "trips",
        forceQuote: ["trip_headsign", "vehicle_journey_code"],
    },
    {
        query: dbClient
            .selectFrom("shape_new")
            .select(["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence", "shape_dist_traveled"])
            .compile().sql,
        fileName: "shapes",
    },
    {
        query: dbClient
            .selectFrom("frequency_new")
            .select(["trip_id", "start_time", "end_time", "headway_secs", "exact_times"])
            .compile().sql,
        fileName: "frequencies",
    },
    {
        query: dbClient
            .selectFrom("calendar_new")
            .select(({ fn }) => [
                sql.lit<string>(`'Bus Open Data Service (BODS)'`).as("feed_publisher_name"),
                sql.lit<string>(`'https://www.bus-data.dft.gov.uk/'`).as("feed_publisher_url"),
                sql.lit<string>(`'EN'`).as("feed_lang"),
                fn.min("start_date").as("feed_start_date"),
                fn.max("end_date").as("feed_end_date"),
                sql.lit<string>(`'${getDate().format("YYYYMMDD_HHmmss")}'`).as("feed_version"),
            ])
            .compile().sql,
        fileName: "feed_info",
    },
];
