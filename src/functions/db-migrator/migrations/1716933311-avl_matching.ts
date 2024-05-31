import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl_bods").addColumn("route_id", "integer").addColumn("trip_id", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl_bods").dropColumn("route_id").dropColumn("trip_id").execute();
}
