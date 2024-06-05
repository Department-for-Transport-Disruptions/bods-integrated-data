import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.createIndex("idx_avl_operatorRef").on("avl").column("operatorRef").execute();
    await db.schema.createIndex("idx_avl_vehicleRef").on("avl").column("vehicleRef").execute();
    await db.schema.createIndex("idx_avl_lineRef").on("avl").column("lineRef").execute();
    await db.schema.createIndex("idx_avl_producerRef").on("avl").column("producerRef").execute();
    await db.schema.createIndex("idx_avl_originRef").on("avl").column("originRef").execute();
    await db.schema.createIndex("idx_avl_destinationRef").on("avl").column("destinationRef").execute();
    await db.schema.createIndex("idx_avl_subscriptionId").on("avl").column("subscriptionId").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_avl_operatorRef").execute();
    await db.schema.dropIndex("idx_avl_vehicleRef").execute();
    await db.schema.dropIndex("idx_avl_lineRef").execute();
    await db.schema.dropIndex("idx_avl_producerRef").execute();
    await db.schema.dropIndex("idx_avl_originRef").execute();
    await db.schema.dropIndex("idx_avl_destinationRef").execute();
    await db.schema.dropIndex("idx_avl_subscriptionId").execute();
}
