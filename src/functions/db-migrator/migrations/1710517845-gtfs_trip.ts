import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("trip")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("route_id", "integer")
        .addColumn("service_id", "integer")
        .addColumn("block_id", "text")
        .addColumn("shape_id", "text")
        .addColumn("trip_headsign", "text")
        .addColumn("wheelchair_accessible", "integer")
        .addColumn("vehicle_journey_code", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("trip").execute();
}
