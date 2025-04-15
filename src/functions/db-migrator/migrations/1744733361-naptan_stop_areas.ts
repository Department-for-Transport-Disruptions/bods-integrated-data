import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
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
        .execute();

    await db.schema.alterTable("naptan_stop").addColumn("stop_area_code", "text").execute();

    await db.schema.createIndex("idx_naptan_stop_stop_area_code").on("naptan_stop").column("stop_area_code").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("naptan_stop_areas").execute();
    await db.schema.alterTable("naptan_stop").dropColumn("stop_area_code").execute();
}
