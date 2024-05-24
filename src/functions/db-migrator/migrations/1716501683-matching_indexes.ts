import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    // Indexes for the route table
    await db.schema.createIndex("idx_route_id_agency_id").on("route").columns(["id", "agency_id"]).execute();

    // Index for the agency table
    await db.schema.createIndex("idx_agency_id").on("agency").columns(["id"]).execute();

    // Indexes for the avl_bods table
    await db.schema
        .createIndex("idx_avl_bods_operator_ref_line_ref_direction_ref_dated_vehicle_journey_ref")
        .on("avl_bods")
        .columns(["operator_ref", "line_ref", "direction_ref", "dated_vehicle_journey_ref"])
        .execute();

    await db.schema.createIndex("idx_avl_bods_vehicle_ref").on("avl_bods").columns(["vehicle_ref"]).execute();

    await db.schema.createIndex("idx_avl_bods_valid_until_time").on("avl_bods").columns(["valid_until_time"]).execute();

    await db.schema
        .createIndex("idx_avl_bods_response_time_stamp")
        .on("avl_bods")
        .columns(["response_time_stamp"])
        .execute();

    // Indexes for the trip table
    await db.schema
        .createIndex("idx_trip_route_id_direction_ticket_machine_journey_code")
        .on("trip")
        .columns(["route_id", "direction", "ticket_machine_journey_code"])
        .execute();

    // Indexes for the calendar table
    await db.schema
        .createIndex("idx_calendar_start_date_end_date_monday")
        .on("calendar")
        .columns(["start_date", "end_date", "monday"])
        .execute();

    await db.schema
        .createIndex("idx_calendar_start_date_end_date_tuesday")
        .on("calendar")
        .columns(["start_date", "end_date", "tuesday"])
        .execute();

    await db.schema
        .createIndex("idx_calendar_start_date_end_date_wednesday")
        .on("calendar")
        .columns(["start_date", "end_date", "wednesday"])
        .execute();

    await db.schema
        .createIndex("idx_calendar_start_date_end_date_thursday")
        .on("calendar")
        .columns(["start_date", "end_date", "thursday"])
        .execute();

    await db.schema
        .createIndex("idx_calendar_start_date_end_date_friday")
        .on("calendar")
        .columns(["start_date", "end_date", "friday"])
        .execute();

    await db.schema
        .createIndex("idx_calendar_start_date_end_date_saturday")
        .on("calendar")
        .columns(["start_date", "end_date", "saturday"])
        .execute();

    await db.schema
        .createIndex("idx_calendar_start_date_end_date_sunday")
        .on("calendar")
        .columns(["start_date", "end_date", "sunday"])
        .execute();

    // Indexes for the calendar_date table
    await db.schema
        .createIndex("idx_calendar_date_service_id_date")
        .on("calendar_date")
        .columns(["service_id", "date"])
        .execute();

    // Indexes for the stop_time table
    await db.schema
        .createIndex("idx_stop_time_trip_id_stop_id_destination_stop_id")
        .on("stop_time")
        .columns(["trip_id", "stop_id", "destination_stop_id"])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    // Drop indexes for the route table
    await db.schema.dropIndex("idx_route_id_agency_id").execute();

    // Drop index for the agency table
    await db.schema.dropIndex("idx_agency_id").execute();

    // Drop indexes for the avl_bods table
    await db.schema.dropIndex("idx_avl_bods_operator_ref_line_ref_direction_ref_dated_vehicle_journey_ref").execute();
    await db.schema.dropIndex("idx_avl_bods_vehicle_ref").execute();
    await db.schema.dropIndex("idx_avl_bods_valid_until_time").execute();
    await db.schema.dropIndex("idx_avl_bods_response_time_stamp").execute();

    // Drop indexes for the trip table
    await db.schema.dropIndex("idx_trip_route_id_direction_ticket_machine_journey_code").execute();
    await db.schema.dropIndex("idx_trip_service_id").execute();

    // Drop indexes for the calendar table
    await db.schema.dropIndex("idx_calendar_monday").execute();
    await db.schema.dropIndex("idx_calendar_tuesday").execute();
    await db.schema.dropIndex("idx_calendar_wednesday").execute();
    await db.schema.dropIndex("idx_calendar_thursday").execute();
    await db.schema.dropIndex("idx_calendar_friday").execute();
    await db.schema.dropIndex("idx_calendar_saturday").execute();
    await db.schema.dropIndex("idx_calendar_sunday").execute();

    // Drop indexes for the calendar_date table
    await db.schema.dropIndex("idx_calendar_date_service_id_date").execute();

    // Drop indexes for the stop_time table
    await db.schema.dropIndex("idx_stop_time_trip_id_stop_id_destination_stop_id").execute();
}
