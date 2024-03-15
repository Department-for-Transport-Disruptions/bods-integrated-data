import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("stop")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("stop_code", "text")
        .addColumn("stop_name", "text")
        .addColumn("stop_lat", "float8")
        .addColumn("stop_lon", "float8")
        .addColumn("wheelchair_boarding", "integer")
        .addColumn("location_type", "integer")
        .addColumn("parent_station", "text")
        .addColumn("platform_code", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("stop").execute();
}
