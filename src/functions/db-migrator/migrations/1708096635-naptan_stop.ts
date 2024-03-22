import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("naptan_stop")
        .addColumn("atco_code", "text", (col) => col.primaryKey())
        .addColumn("naptan_code", "text")
        .addColumn("plate_code", "text")
        .addColumn("cleardown_code", "text")
        .addColumn("common_name", "text")
        .addColumn("common_name_lang", "text")
        .addColumn("short_common_name", "text")
        .addColumn("short_common_name_lang", "text")
        .addColumn("landmark", "text")
        .addColumn("landmark_lang", "text")
        .addColumn("street", "text")
        .addColumn("street_lang", "text")
        .addColumn("crossing", "text")
        .addColumn("crossing_lang", "text")
        .addColumn("indicator", "text")
        .addColumn("indicator_lang", "text")
        .addColumn("bearing", "text")
        .addColumn("nptg_locality_code", "text")
        .addColumn("locality_name", "text")
        .addColumn("parent_locality_name", "text")
        .addColumn("grand_parent_locality_name", "text")
        .addColumn("town", "text")
        .addColumn("town_lang", "text")
        .addColumn("suburb", "text")
        .addColumn("suburb_lang", "text")
        .addColumn("locality_centre", "text")
        .addColumn("grid_type", "text")
        .addColumn("easting", "text")
        .addColumn("northing", "text")
        .addColumn("longitude", "text")
        .addColumn("latitude", "text")
        .addColumn("stop_type", "text")
        .addColumn("bus_stop_type", "text")
        .addColumn("timing_status", "text")
        .addColumn("default_wait_time", "text")
        .addColumn("notes", "text")
        .addColumn("notes_lang", "text")
        .addColumn("administrative_area_code", "text")
        .addColumn("creation_date_time", "text")
        .addColumn("modification_date_time", "text")
        .addColumn("revision_number", "text")
        .addColumn("modification", "text")
        .addColumn("status", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("naptan_stop").execute();
}
