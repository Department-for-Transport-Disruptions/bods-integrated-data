import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("calendar_date")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("service_id", "integer")
        .addColumn("date", "text")
        .addColumn("exception_type", "integer")
        .execute();

    await db.schema
        .alterTable("calendar_date")
        .addUniqueConstraint("uniq_calendar_date_service_id_date_exception_type", [
            "service_id",
            "date",
            "exception_type",
        ])
        .execute();

    await db.schema.createIndex("idx_calendar_date_service_id").on("calendar_date").column("service_id").execute();

    await db.schema
        .alterTable("calendar")
        .addColumn("calendar_hash", "text", (ac) => ac.unique())
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("calendar_date").execute();
    await db.schema.alterTable("calendar").dropColumn("calendar_hash").execute();
}
