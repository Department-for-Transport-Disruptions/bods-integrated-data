import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("stop_time").addColumn("exclude", "boolean").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("stop_time").dropColumn("exclude").execute();
}
