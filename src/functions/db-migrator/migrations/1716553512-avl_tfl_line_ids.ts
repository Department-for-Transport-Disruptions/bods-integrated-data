import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("tfl_line")
        .addColumn("id", "text", (col) => col.primaryKey())
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("tfl_line").execute();
}
