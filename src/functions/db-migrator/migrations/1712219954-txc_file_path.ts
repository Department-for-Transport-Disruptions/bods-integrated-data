import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("trip").addColumn("file_path", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("trip").dropColumn("file_path").execute();
}
