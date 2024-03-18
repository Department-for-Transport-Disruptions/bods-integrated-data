import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("trip")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("route_id", "integer")
        .addColumn("service_id", "integer")
        .addColumn("block_id", "integer")
        .addColumn("shape_id", "integer")
        .addColumn("trip_headsign", "text")
        .addColumn("wheelchair_accessible", "integer")
        .addColumn("vehicle_journey_code", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("trip").execute();
}
