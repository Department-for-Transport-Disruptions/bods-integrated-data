import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.createIndex("idx_situation_subscription_id").on("situation").column("subscription_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_situation_subscription_id").execute();
}
