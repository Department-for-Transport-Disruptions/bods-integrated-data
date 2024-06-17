import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_avl_bods_vehicle_ref_operator_ref_response_time_stamp").execute();
    await db.schema
        .createIndex("idx_avl_bods_vehicle_ref_operator_ref_recorded_at_time")
        .on("avl_bods")
        .columns(["vehicle_ref", "operator_ref", "recorded_at_time"])
        .execute();
    await db.schema
        .createIndex("idx_avl_operator_ref_vehicle_ref_recorded_at_time")
        .on("avl")
        .columns(["operator_ref", "vehicle_ref", "recorded_at_time"])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createIndex("idx_avl_bods_vehicle_ref_operator_ref_response_time_stamp")
        .on("avl_bods")
        .columns(["vehicle_ref", "operator_ref", "response_time_stamp"])
        .execute();
    await db.schema.dropIndex("idx_avl_bods_vehicle_ref_operator_ref_recorded_at_time").execute();
    await db.schema.dropIndex("idx_avl_operator_ref_vehicle_ref_recorded_at_time").execute();
}
