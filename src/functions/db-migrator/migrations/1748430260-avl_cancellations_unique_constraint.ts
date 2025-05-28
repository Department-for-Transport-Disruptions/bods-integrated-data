import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl_cancellation")
        .dropConstraint("uniq_avl_cancellation_data_frame_journey_line_direction_ref")
        .execute();

    await db.schema
        .alterTable("avl_cancellation")
        .addUniqueConstraint("uniq_avl_cancellation_data_frame_journey_line_direction_ref", [
            "data_frame_ref",
            "dated_vehicle_journey_ref",
            "line_ref",
            "direction_ref",
            "vehicle_monitoring_ref",
        ])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl_cancellation")
        .dropConstraint("uniq_avl_cancellation_data_frame_journey_line_direction_ref")
        .execute();

    await db.schema
        .alterTable("avl_cancellation")
        .addUniqueConstraint("uniq_avl_cancellation_data_frame_journey_line_direction_ref", [
            "data_frame_ref",
            "dated_vehicle_journey_ref",
            "line_ref",
            "direction_ref",
        ])
        .execute();
}
