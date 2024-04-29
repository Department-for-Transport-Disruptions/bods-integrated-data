import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("route")
        .addColumn("data_source", "text")
        .addColumn("noc_line_name", "text", (col) => col.unique())
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("route").dropColumn("data_source").dropColumn("noc_line_name").execute();
}
