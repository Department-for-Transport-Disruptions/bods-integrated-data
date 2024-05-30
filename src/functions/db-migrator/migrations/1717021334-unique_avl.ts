import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.deleteFrom("avl_bods").execute();
    await db.schema
        .alterTable("avl_bods")
        .addUniqueConstraint("uniq_avl_bods_vehicle_ref_operator_ref_recorded_at_time", [
            "vehicle_ref",
            "operator_ref",
            "recorded_at_time",
        ])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl_bods")
        .dropConstraint("uniq_avl_bods_vehicle_ref_operator_ref_recorded_at_time")
        .execute();
}
