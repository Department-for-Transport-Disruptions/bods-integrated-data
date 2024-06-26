import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("agency")
        .addColumn("id", "integer", (col) => col.primaryKey().generatedByDefaultAsIdentity())
        .addColumn("name", "text")
        .addColumn("url", "text")
        .addColumn("phone", "text")
        .addColumn("noc", "text", (col) => col.unique())
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("agency").execute();
}
