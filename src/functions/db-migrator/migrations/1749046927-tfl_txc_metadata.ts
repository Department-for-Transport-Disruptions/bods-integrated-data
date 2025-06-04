import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("tfl_txc_metadata")
        .addColumn("line_id", "text", (col) => col.primaryKey())
        .addColumn("revision", "integer", (col) => col.defaultTo(0))
        .addColumn("creation_datetime", "timestamptz", (col) => col.defaultTo(sql`now()`))
        .addColumn("modification_datetime", "timestamptz")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("tfl_txc_metadata").execute();
}
