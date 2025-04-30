import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("tfl_vehicle")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("registration_number", "varchar(20)", (col) => col.notNull())
        .addColumn("bonnet_no", "varchar(10)", (col) => col.notNull())
        .addColumn("operator_agency", "varchar(128)", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_operator")
        .addColumn("id", "varchar(10)", (col) => col.primaryKey())
        .addColumn("operator_name", "varchar(128)")
        .addColumn("operator_agency", "varchar(128)", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_garage")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("garage_code", "varchar(10)", (col) => col.notNull())
        .addColumn("garage_name", "varchar(256)", (col) => col.notNull())
        .addColumn("operator_code", "varchar(10)", (col) => col.notNull().references("tfl_operator.id"))
        .execute();

    await db.schema
        .createTable("tfl_block")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("block_no", "integer", (col) => col.notNull())
        .addColumn("running_no", "integer", (col) => col.notNull())
        .addColumn("garage_no", "integer", (col) => col.references("tfl_garage.id"))
        .addColumn("operator_code", "varchar(10)", (col) => col.notNull().references("tfl_operator.id"))
        .execute();

    await db.schema
        .createTable("tfl_block_calendar_day")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("block_id", "integer", (col) => col.notNull().references("tfl_block.id"))
        .addColumn("calendar_day", "date", (col) => col.notNull())
        .addColumn("block_runs_on_day", "integer", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_stop_point")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("stop_code_lbsl", "varchar(15)")
        .addColumn("stop_name", "varchar(40)", (col) => col.notNull())
        .addColumn("location_easting", "integer")
        .addColumn("location_northing", "integer")
        .addColumn("location_longitude", "float8", (col) => col.notNull())
        .addColumn("location_latitude", "float8", (col) => col.notNull())
        .addColumn("point_letter", "varchar(3)")
        .addColumn("naptan_code", "varchar(15)")
        .addColumn("sms_code", "varchar(15)")
        .addColumn("stop_area", "varchar(12)", (col) => col.notNull())
        .addColumn("borough_code", "varchar(3)")
        .addColumn("heading", "integer")
        .addColumn("stop_type", "varchar(256)", (col) => col.notNull())
        .addColumn("street_name", "varchar(256)")
        .addColumn("post_code", "varchar(10)")
        .addColumn("towards", "varchar(128)", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_destination")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("long_destination_name", "varchar(40)", (col) => col.notNull())
        .addColumn("short_destination_name", "varchar(15)")
        .execute();

    await db.schema
        .createTable("tfl_route_geometry")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("contract_line_no", "varchar(6)", (col) => col.notNull())
        .addColumn("lbsl_run_no", "integer", (col) => col.notNull())
        .addColumn("sequence_no", "integer", (col) => col.notNull())
        .addColumn("direction", "integer", (col) => col.notNull())
        .addColumn("location_easting", "integer", (col) => col.notNull())
        .addColumn("location_northing", "integer", (col) => col.notNull())
        .addColumn("location_longitude", "float8", (col) => col.notNull())
        .addColumn("location_latitude", "float8", (col) => col.notNull())
        .execute();

    await db.schema
        .alterTable("tfl_line")
        .addColumn("service_line_no", "varchar(6)", (col) => col.notNull())
        .addColumn("logical_line_no", "integer", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_pattern")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("direction", "integer", (col) => col.notNull())
        .addColumn("type", "integer", (col) => col.notNull())
        .addColumn("contract_line_no", "text", (col) => col.notNull().references("tfl_line.id"))
        .execute();

    await db.schema
        .createTable("tfl_stop_in_pattern")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("sequence_no", "integer", (col) => col.notNull())
        .addColumn("pattern_id", "integer", (col) => col.notNull().references("tfl_pattern.id"))
        .addColumn("destination_id", "integer", (col) => col.references("tfl_destination.id"))
        .addColumn("stop_point_id", "integer", (col) => col.notNull().references("tfl_stop_point.id"))
        .addColumn("timing_point_code", "varchar(10)", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_journey")
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("trip_no_lbsl", "integer", (col) => col.notNull())
        .addColumn("type", "integer", (col) => col.notNull())
        .addColumn("start_time", "integer", (col) => col.notNull())
        .addColumn("pattern_id", "integer", (col) => col.notNull().references("tfl_pattern.id"))
        .addColumn("block_id", "integer", (col) => col.notNull().references("tfl_block.id"))
        .execute();

    await db.schema
        .createTable("tfl_journey_wait_time")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("journey_id", "integer", (col) => col.notNull().references("tfl_journey.id"))
        .addColumn("stop_in_pattern_id", "integer", (col) => col.notNull().references("tfl_stop_in_pattern.id"))
        .addColumn("wait_time", "integer", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("tfl_journey_drive_time")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("journey_id", "integer", (col) => col.notNull().references("tfl_journey.id"))
        .addColumn("stop_in_pattern_from_id", "integer", (col) => col.notNull().references("tfl_stop_in_pattern.id"))
        .addColumn("stop_in_pattern_to_id", "integer", (col) => col.notNull().references("tfl_stop_in_pattern.id"))
        .addColumn("drive_time", "integer", (col) => col.notNull())
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("tfl_journey_drive_time").execute();
    await db.schema.dropTable("tfl_journey_wait_time").execute();
    await db.schema.dropTable("tfl_journey").execute();
    await db.schema.dropTable("tfl_stop_in_pattern").execute();
    await db.schema.dropTable("tfl_pattern").execute();
    await db.schema.alterTable("tfl_line").dropColumn("service_line_no").dropColumn("logical_line_no").execute();
    await db.schema.dropTable("tfl_route_geometry").execute();
    await db.schema.dropTable("tfl_destination").execute();
    await db.schema.dropTable("tfl_stop_point").execute();
    await db.schema.dropTable("tfl_block_calendar_day").execute();
    await db.schema.dropTable("tfl_block").execute();
    await db.schema.dropTable("tfl_garage").execute();
    await db.schema.dropTable("tfl_operator").execute();
    await db.schema.dropTable("tfl_vehicle").execute();
}
