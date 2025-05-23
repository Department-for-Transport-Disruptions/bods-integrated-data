import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("situation")
        .addColumn("display_id", "uuid", (eb) => eb.defaultTo(sql`gen_random_uuid()`))
        .execute();

    await db.schema.createIndex("idx_situation_display_id").on("situation").column("display_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("situation").dropColumn("display_id").execute();
}
