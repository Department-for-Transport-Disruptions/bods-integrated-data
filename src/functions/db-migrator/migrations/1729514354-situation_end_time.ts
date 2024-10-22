import { Kysely } from "kysely";
import { Database } from "@bods-integrated-data/shared/database";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("situation").addColumn("end_time", "timestamptz").execute();

    await db.schema
        .createIndex("idx_situation_subscription_id_situation_number_end_time")
        .on("situation")
        .columns(["subscription_id", "situation_number", "end_time"])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("situation").dropColumn("timestamptz").execute();
    await db.schema.dropIndex("idx_situation_subscription_id_situation_number_end_time").execute();
}
