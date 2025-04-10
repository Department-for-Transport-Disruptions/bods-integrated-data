import { Kysely } from "kysely";
import { Database } from "@bods-integrated-data/shared/database";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("naptan_stop").addColumn("stop_area_code", "text").execute();

    await db.schema
        .createTable("naptan_stop_area")
        .addColumn("stop_area_code", "text", (col) => col.primaryKey())
        .addColumn("name", "text")
        .addColumn("administrative_area_code", "text")
        .addColumn("stop_area_type", "text")
        .addColumn("grid_type", "text")
        .addColumn("easting", "text")
        .addColumn("northing", "text")
        .addColumn("longitude", "text")
        .addColumn("latitude", "text")
        .addForeignKeyConstraint("stop_area_code_foreign", ["stop_area_code"], "naptan_stop", ["stop_area_code"])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("naptan_stop_areas").execute();
    await db.schema.alterTable("naptan_stop").dropColumn("stop_area_code").execute();
}
