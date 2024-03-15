import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("route")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("agency_id", "integer")
        .addColumn("route_short_name", "text")
        .addColumn("route_long_name", "text")
        .addColumn("route_type", "integer")
        .addColumn("line_id", "text", (col) => col.unique())
        .execute();

    await db.schema.createIndex("idx_route_agency_id").on("route").column("agency_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("route").execute();
}
