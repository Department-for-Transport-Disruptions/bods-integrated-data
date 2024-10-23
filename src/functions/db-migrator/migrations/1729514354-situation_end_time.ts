import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("situation").addColumn("end_time", "timestamptz").execute();
    await db.schema.createIndex("idx_situation_end_time").on("situation").column("end_time").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_situation_end_time").execute();
    await db.schema.alterTable("situation").dropColumn("end_time").execute();
}
