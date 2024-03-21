import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("stop_time")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("trip_id", "integer")
        .addColumn("stop_id", "text")
        .addColumn("arrival_time", "text")
        .addColumn("departure_time", "text")
        .addColumn("stop_sequence", "integer")
        .addColumn("stop_headsign", "text")
        .addColumn("pickup_type", "integer")
        .addColumn("drop_off_type", "integer")
        .addColumn("shape_dist_traveled", "integer")
        .addColumn("timepoint", "integer")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("stop_time").execute();
}
