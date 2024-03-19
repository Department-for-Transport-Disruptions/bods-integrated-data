import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("calendar")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("monday", "integer")
        .addColumn("tuesday", "integer")
        .addColumn("wednesday", "integer")
        .addColumn("thursday", "integer")
        .addColumn("friday", "integer")
        .addColumn("saturday", "integer")
        .addColumn("sunday", "integer")
        .addColumn("start_date", "text")
        .addColumn("end_date", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("calendar").execute();
}
