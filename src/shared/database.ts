import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Kysely, PostgresDialect, Insertable, Selectable, Updateable, Generated } from "kysely";
import { Pool } from "pg";

const smClient = new SecretsManagerClient({ region: "eu-west-2" });

export const getDatabaseClient = async (isLocal = false) => {
    if (isLocal) {
        return new Kysely<Database>({
            dialect: new PostgresDialect({
                pool: new Pool({
                    host: "127.0.0.1",
                    port: 5432,
                    database: "bods_integrated_data",
                    user: "postgres",
                    password: "password",
                }),
            }),
        });
    }

    const { DB_HOST: dbHost, DB_PORT: dbPort, DB_SECRET_ARN: databaseSecretArn, DB_NAME: dbName } = process.env;

    if (!dbHost || !dbPort || !databaseSecretArn || !dbName) {
        throw new Error("Missing env vars");
    }

    const databaseSecret = await smClient.send(
        new GetSecretValueCommand({
            SecretId: databaseSecretArn,
        }),
    );

    if (!databaseSecret.SecretString) {
        throw new Error("Database secret could not be retrieved");
    }

    const parsedSecret = JSON.parse(databaseSecret.SecretString) as { username: string; password: string };

    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({
                host: dbHost,
                port: Number(dbPort),
                database: dbName,
                user: parsedSecret.username,
                password: parsedSecret.password,
            }),
        }),
    });
};

export interface Database {
    naptan_stop: NaptanStopTable;
    naptan_stop_new: NaptanStopTable;
    naptan_stop_old: NaptanStopTable;
    avl: AvlTable;
    agency: GtfsAgencyTable;
    agency_new: GtfsAgencyTable;
    agency_old: GtfsAgencyTable;
    calendar: GtfsCalendarTable;
    calendar_new: GtfsCalendarTable;
    calendar_old: GtfsCalendarTable;
    calendar_date: GtfsCalendarDateTable;
    calendar_date_new: GtfsCalendarDateTable;
    route: GtfsRouteTable;
    route_new: GtfsRouteTable;
    stop: GtfsStopTable;
    stop_new: GtfsStopTable;
}

export interface NaptanStopTable {
    atco_code: string;
    naptan_code: string | null;
    plate_code: string | null;
    cleardown_code: string | null;
    common_name: string | null;
    common_name_lang: string | null;
    short_common_name: string | null;
    short_common_name_lang: string | null;
    landmark: string | null;
    landmark_lang: string | null;
    street: string | null;
    street_lang: string | null;
    crossing: string | null;
    crossing_lang: string | null;
    indicator: string | null;
    indicator_lang: string | null;
    bearing: string | null;
    nptg_locality_code: string | null;
    locality_name: string | null;
    parent_locality_name: string | null;
    grand_parent_locality_name: string | null;
    town: string | null;
    town_lang: string | null;
    suburb: string | null;
    suburb_lang: string | null;
    locality_centre: string | null;
    grid_type: string | null;
    easting: string | null;
    northing: string | null;
    longitude: string | null;
    latitude: string | null;
    stop_type: string | null;
    bus_stop_type: string | null;
    timing_status: string | null;
    default_wait_time: string | null;
    notes: string | null;
    notes_lang: string | null;
    administrative_area_code: string | null;
    creation_date_time: string | null;
    modification_date_time: string | null;
    revision_number: string | null;
    modification: string | null;
    status: string | null;
}

export type NaptanStop = Selectable<NaptanStopTable>;
export type NewNaptanStop = Insertable<NaptanStopTable>;
export type NaptanStopUpdate = Updateable<NaptanStopTable>;

export interface AvlTable {
    id: Generated<number>;
    response_time_stamp: string;
    producer_ref: string;
    recorded_at_time: string;
    valid_until_time: string;
    line_ref: string | null;
    direction_ref: string;
    operator_ref: string;
    data_frame_ref: string | null;
    dated_vehicle_journey_ref: string | null;
    vehicle_ref: string;
    longitude: number;
    latitude: number;
    bearing: string | null;
    published_line_name: string | null;
    origin_ref: string | null;
    destination_ref: string | null;
    block_ref: string | null;
}

export type Avl = Selectable<AvlTable>;
export type NewAvl = Insertable<AvlTable>;
export type AvlUpdate = Updateable<AvlTable>;

export interface GtfsAgencyTable {
    id: Generated<number>;
    name: string;
    url: string;
    phone: string | null;
    noc: string;
    registered_operator_ref: string;
}

export type Agency = Selectable<GtfsAgencyTable>;
export type NewAgency = Insertable<GtfsAgencyTable>;
export type AgencyUpdate = Updateable<GtfsAgencyTable>;

export interface GtfsCalendarTable {
    id: Generated<number>;
    monday: 0 | 1;
    tuesday: 0 | 1;
    wednesday: 0 | 1;
    thursday: 0 | 1;
    friday: 0 | 1;
    saturday: 0 | 1;
    sunday: 0 | 1;
    start_date: string;
    end_date: string;
    calendar_hash: string | null;
}

export type Calendar = Selectable<GtfsCalendarTable>;
export type NewCalendar = Insertable<GtfsCalendarTable>;
export type CalendarUpdate = Updateable<GtfsCalendarTable>;

export interface GtfsCalendarDateTable {
    id: Generated<number>;
    service_id: number | null;
    date: string;
    exception_type: 1 | 2;
}

export type CalendarDate = Selectable<GtfsCalendarDateTable>;
export type NewCalendarDate = Insertable<GtfsCalendarDateTable>;
export type CalendarDateUpdate = Updateable<GtfsCalendarDateTable>;

export enum RouteType {
    TramOrMetro = 0,
    Underground = 1,
    Bus = 3,
    Ferry = 4,
    Coach = 200,
}

export interface GtfsRouteTable {
    id: Generated<number>;
    agency_id: number;
    route_short_name: string;
    route_long_name: string;
    route_type: RouteType;
    line_id: string;
}

export type Route = Selectable<GtfsRouteTable>;
export type NewRoute = Insertable<GtfsRouteTable>;
export type RouteUpdate = Updateable<GtfsRouteTable>;

export enum LocationType {
    None = 0,
    StopAreas = 1,
    RealStationEntrance = 2,
}

export interface GtfsStopTable {
    id: string;
    stop_code: string | null;
    stop_name: string | null;
    stop_lat: number | null;
    stop_lon: number | null;
    wheelchair_boarding: number;
    location_type: number;
    parent_station: string;
    platform_code: string;
}

export type Stop = Selectable<GtfsStopTable>;
export type NewStop = Insertable<GtfsStopTable>;
export type StopUpdate = Updateable<GtfsStopTable>;
