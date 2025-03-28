import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await sql`TRUNCATE TABLE ${sql.ref("stop_time")}`.execute(db);

    await db.schema.alterTable("frequency").addUniqueConstraint("uniq_frequency_trip_id", ["trip_id"]).execute();
    await db.schema
        .alterTable("stop_time")
        .addUniqueConstraint("uniq_stop_time_trip_id_stop_sequence", ["trip_id", "stop_sequence"])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("frequency").dropConstraint("uniq_frequency_trip_id").execute();
    await db.schema.alterTable("stop_time").dropConstraint("uniq_stop_time_trip_id_stop_sequence").execute();
}
