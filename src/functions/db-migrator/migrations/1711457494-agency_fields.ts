import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("agency")
        .addColumn("timezone", "text", (cb) => cb.defaultTo("Europe/London"))
        .addColumn("lang", "text", (cb) => cb.defaultTo("EN"))
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("agency").dropColumn("timezone").dropColumn("lang").execute();
}
