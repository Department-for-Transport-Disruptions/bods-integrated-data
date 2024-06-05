import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("trip")
        .addColumn("origin_stop_ref", "text")
        .addColumn("destination_stop_ref", "text")
        .addColumn("revision_number", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("trip")
        .dropColumn("origin_stop_ref")
        .dropColumn("destination_stop_ref")
        .dropColumn("revision_number")
        .execute();
}
