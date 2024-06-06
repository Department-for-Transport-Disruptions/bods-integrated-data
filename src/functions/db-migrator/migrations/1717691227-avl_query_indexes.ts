import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.createIndex("idx_avl_operator_ref").on("avl").column("operator_ref").execute();
    await db.schema.createIndex("idx_avl_vehicle_ref").on("avl").column("vehicle_ref").execute();
    await db.schema.createIndex("idx_avl_line_ref").on("avl").column("line_ref").execute();
    await db.schema.createIndex("idx_avl_producer_ref").on("avl").column("producer_ref").execute();
    await db.schema.createIndex("idx_avl_origin_ref").on("avl").column("origin_ref").execute();
    await db.schema.createIndex("idx_avl_destination_ref").on("avl").column("destination_ref").execute();
    await db.schema.createIndex("idx_avl_subscription_id").on("avl").column("subscription_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_avl_operator_ref").execute();
    await db.schema.dropIndex("idx_avl_vehicle_ref").execute();
    await db.schema.dropIndex("idx_avl_line_ref").execute();
    await db.schema.dropIndex("idx_avl_producer_ref").execute();
    await db.schema.dropIndex("idx_avl_origin_ref").execute();
    await db.schema.dropIndex("idx_avl_destination_ref").execute();
    await db.schema.dropIndex("idx_avl_subscription_id").execute();
}
