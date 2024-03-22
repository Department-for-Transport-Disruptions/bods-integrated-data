import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("frequency")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("trip_id", "text")
        .addColumn("start_time", "text")
        .addColumn("end_time", "text")
        .addColumn("headway_secs", "integer")
        .addColumn("exact_times", "integer")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("frequency").execute();
}
