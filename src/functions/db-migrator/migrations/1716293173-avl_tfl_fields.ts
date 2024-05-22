import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .addColumn("vehicle_name", "text")
        .addColumn("monitored", "text")
        .addColumn("load", "integer")
        .addColumn("passenger_count", "integer")
        .addColumn("odometer", "integer")
        .addColumn("headway_deviation", "integer")
        .addColumn("schedule_deviation", "integer")
        .addColumn("vehicle_state", "integer")
        .addColumn("next_stop_point_id", "text")
        .addColumn("next_stop_point_name", "text")
        .addColumn("previous_stop_point_id", "text")
        .addColumn("previous_stop_point_name", "text")
        .addColumn("origin_name", "text")
        .addColumn("destination_name", "text")
        .addColumn("vehicle_journey_ref", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl").dropColumn("occupancy").execute();
}
