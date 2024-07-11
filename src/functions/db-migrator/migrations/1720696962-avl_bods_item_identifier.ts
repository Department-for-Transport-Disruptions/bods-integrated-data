import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl_bods").addColumn("item_id", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl_bods").dropColumn("item_id").execute();
}
