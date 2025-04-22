import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("avl_cancellation")
        .addColumn("id", "bigint", (col) => col.primaryKey().generatedByDefaultAsIdentity())
        .addColumn("response_time_stamp", sql`TIMESTAMPTZ`)
        .addColumn("recorded_at_time", sql`TIMESTAMPTZ`)
        .addColumn("vehicle_monitoring_ref", "text")
        .addColumn("data_frame_ref", "text")
        .addColumn("dated_vehicle_journey_ref", "text")
        .addColumn("line_ref", "text")
        .addColumn("direction_ref", "text")
        .addColumn("subscription_id", "text")
        .addUniqueConstraint("uniq_avl_cancellation_data_frame_journey_line_direction_ref", [
            "data_frame_ref",
            "dated_vehicle_journey_ref",
            "line_ref",
            "direction_ref",
        ])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("avl_cancellation").execute();
}
