import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .addUniqueConstraint("uniq_avl_vehicle_ref_operator_ref", ["vehicle_ref", "operator_ref"])
        .execute();

    await db.schema.createIndex("idx_avl_recorded_at_time").on("avl").column("recorded_at_time").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl").dropConstraint("uniq_avl_vehicle_ref_operator_ref").execute();

    await db.schema.dropIndex("idx_avl_recorded_at_time").on("avl").execute();
}
