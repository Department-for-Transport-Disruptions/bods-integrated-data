import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("situation")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("subscription_id", "text")
        .addColumn("response_time_stamp", "text")
        .addColumn("producer_ref", "text")
        .addColumn("situation_number", "text")
        .addColumn("version", "integer")
        .addColumn("situation", "json")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("situation").execute();
}
