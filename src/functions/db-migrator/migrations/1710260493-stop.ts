import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("stop")
        .addColumn("id", "varchar(255)", (col) => col.primaryKey().unique())
        .addColumn("stop_code", "varchar(255)")
        .addColumn("stop_name", "varchar(255)")
        .addColumn("stop_lat", "float8")
        .addColumn("stop_lon", "float8")
        .addColumn("wheelchair_boarding", "integer")
        .addColumn("location_type", "integer")
        .addColumn("parent_station", "varchar(255)")
        .addColumn("platform_code", "varchar(255)")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("stop").execute();
}
