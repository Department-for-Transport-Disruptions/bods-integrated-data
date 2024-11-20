import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl").addColumn("route_id", "integer").addColumn("trip_id", "text").execute();
    await db.schema.createIndex("idx_avl_route_id").on("avl").column("route_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_avl_route_id").on("avl").execute();
    await db.schema.alterTable("avl").dropColumn("route_id").dropColumn("trip_id").execute();
}
