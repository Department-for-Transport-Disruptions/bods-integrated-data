import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Generated, Insertable, Kysely, PostgresDialect, RawBuilder, Selectable, Updateable } from "kysely";
import { Pool } from "pg";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const smClient = new SecretsManagerClient({ region: "eu-west-2" });

export const getDatabaseClient = async (isLocal = false) => {
    if (isLocal) {
        return new Kysely<Database>({
            dialect: new PostgresDialect({
                pool: new Pool({
                    host: localStackHost ? "bods_integrated_data_postgres" : "127.0.0.1",
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
    nptg_admin_area: NptgAdminAreaTable;
    nptg_admin_area_new: NptgAdminAreaTable;
    nptg_locality: NptgLocalityTable;
    nptg_locality_new: NptgLocalityTable;
    nptg_region: NptgRegionTable;
    nptg_region_new: NptgRegionTable;
    avl: AvlTable;
    avl_bods: AvlTable;
    agency: GtfsAgencyTable;
    calendar: GtfsCalendarTable;
    calendar_new: GtfsCalendarTable;
    frequency: GtfsFrequencyTable;
    frequency_new: GtfsFrequencyTable;
    calendar_date: GtfsCalendarDateTable;
    calendar_date_new: GtfsCalendarDateTable;
    route: GtfsRouteTable;
    route_new: GtfsRouteTable;
    shape: GtfsShapeTable;
    shape_new: GtfsShapeTable;
    stop: GtfsStopTable;
    stop_new: GtfsStopTable;
    stop_time: GtfsStopTimeTable;
    stop_time_new: GtfsStopTimeTable;
    trip: GtfsTripTable;
    trip_new: GtfsTripTable;
    noc_operator: NocOperatorTable;
    noc_operator_new: NocOperatorTable;
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

export interface NptgAdminAreaTable {
    admin_area_code: string;
    atco_code: string;
    name: string;
    region_code: string;
}

export type NptgAdminArea = Selectable<NptgAdminAreaTable>;
export type NewNptgAdminArea = Insertable<NptgAdminAreaTable>;
export type NptgAdminAreaUpdate = Updateable<NptgAdminAreaTable>;

export interface NptgLocalityTable {
    locality_code: string;
    admin_area_ref: string;
}

export type NptgLocality = Selectable<NptgLocalityTable>;
export type NewNptgLocality = Insertable<NptgLocalityTable>;
export type NptgLocalityUpdate = Updateable<NptgLocalityTable>;

export interface NptgRegionTable {
    region_code: string;
    name: string;
}

export type NptgRegion = Selectable<NptgRegionTable>;
export type NewNptgRegion = Insertable<NptgRegionTable>;
export type NptgRegionUpdate = Updateable<NptgRegionTable>;

export type Point = {
    longitude: number;
    latitude: number;
};

export interface AvlTable {
    id: Generated<number>;
    response_time_stamp: string;
    producer_ref: string;
    recorded_at_time: string;
    valid_until_time: string;
    line_ref: string | null;
    direction_ref: string | null;
    occupancy: string | null;
    operator_ref: string;
    data_frame_ref: string | null;
    dated_vehicle_journey_ref: string | null;
    vehicle_ref: string;
    longitude: number;
    latitude: number;
    bearing: string | null;
    published_line_name: string | null;
    origin_ref: string | null;
    origin_aimed_departure_time: string | null;
    destination_ref: string | null;
    block_ref: string | null;
    geom: RawBuilder<string> | null;
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
    timezone: string | null;
    lang: string | null;
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
    calendar_hash: string;
}

export type Calendar = Selectable<GtfsCalendarTable>;
export type NewCalendar = Insertable<GtfsCalendarTable>;
export type CalendarUpdate = Updateable<GtfsCalendarTable>;

export enum CalendarDateExceptionType {
    ServiceAdded = 1,
    ServiceRemoved = 2,
}

export interface GtfsCalendarDateTable {
    id: Generated<number>;
    service_id: number;
    date: string;
    exception_type: CalendarDateExceptionType;
}

export type CalendarDate = Selectable<GtfsCalendarDateTable>;
export type NewCalendarDate = Insertable<GtfsCalendarDateTable>;
export type CalendarDateUpdate = Updateable<GtfsCalendarDateTable>;

export enum ServiceType {
    FrequencyBased = 0,
    ScheduleBased = 1,
}

export interface GtfsFrequencyTable {
    id: Generated<number>;
    trip_id: string;
    start_time: string;
    end_time: string;
    headway_secs: number;
    exact_times: number;
}

export type Frequency = Selectable<GtfsFrequencyTable>;
export type NewFrequency = Insertable<GtfsFrequencyTable>;

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
    data_source: "bods" | "tnds";
    noc_line_name: string;
}

export type Route = Selectable<GtfsRouteTable>;
export type NewRoute = Insertable<GtfsRouteTable>;
export type RouteUpdate = Updateable<GtfsRouteTable>;

export interface GtfsShapeTable {
    id: Generated<number>;
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_pt_sequence: number;
    shape_dist_traveled: number;
}

export type Shape = Selectable<GtfsShapeTable>;
export type NewShape = Insertable<GtfsShapeTable>;
export type ShapeUpdate = Updateable<GtfsShapeTable>;

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
    parent_station: string | null;
    platform_code: string | null;
    region_code: string | null;
}

export type Stop = Selectable<GtfsStopTable>;
export type NewStop = Insertable<GtfsStopTable>;
export type StopUpdate = Updateable<GtfsStopTable>;

export enum PickupType {
    Pickup = 0,
    NoPickup = 1,
    ArrangeableByPhone = 2,
    ArrangeableWithDriver = 3,
}

export enum DropOffType {
    DropOff = 0,
    NoDropOff = 1,
    ArrangeableByPhone = 2,
    ArrangeableWithDriver = 3,
}

export enum Timepoint {
    Approximate = 0,
    Exact = 1,
}

export interface GtfsStopTimeTable {
    id: Generated<number>;
    trip_id: string;
    stop_id: string;
    arrival_time: string;
    departure_time: string;
    stop_sequence: number;
    stop_headsign: string;
    pickup_type: PickupType;
    drop_off_type: DropOffType;
    shape_dist_traveled: number;
    timepoint: Timepoint;
}

export type StopTime = Selectable<GtfsStopTimeTable>;
export type NewStopTime = Insertable<GtfsStopTimeTable>;

export enum WheelchairAccessibility {
    NoAccessibilityInformation = 0,
    Accessible = 1,
    NotAccessible = 2,
}

export interface GtfsTripTable {
    id: string;
    route_id: number;
    service_id: number;
    block_id: string;
    shape_id: string;
    trip_headsign: string;
    wheelchair_accessible: WheelchairAccessibility;
    vehicle_journey_code: string;
    ticket_machine_journey_code: string;
    file_path: string;
}

export type Trip = Selectable<GtfsTripTable>;
export type NewTrip = Insertable<GtfsTripTable>;
export type TripUpdate = Updateable<GtfsTripTable>;

export interface NocOperatorTable {
    noc: string;
    operator_public_name: string;
    vosa_psv_license_name: string;
    op_id: string;
    pub_nm_id: string;
}

export type NocOperator = Selectable<NocOperatorTable>;
export type NewNocOperator = Insertable<NocOperatorTable>;
export type NocOperatorUpdate = Updateable<NocOperatorTable>;

export type KyselyDb = Kysely<Database>;
