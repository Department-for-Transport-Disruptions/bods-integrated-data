import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("stop_time").addColumn("destination_stop_id", "text").execute();
    await db.schema
        .createIndex("idx_stop_time_destination_stop_id")
        .on("stop_time")
        .column("destination_stop_id")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("stop_time").dropColumn("destination_stop_id").execute();
    await db.schema.dropIndex("idx_stop_time_destination_stop_id").on("stop_time").execute();
}
