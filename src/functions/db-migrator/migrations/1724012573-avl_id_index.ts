import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.createIndex("idx_avl_onward_call_avl_id").on("avl_onward_call").column("avl_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_avl_onward_call_avl_id").on("avl_onward_call").execute();
}
