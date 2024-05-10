import agencies from "@bods-integrated-data/shared/data/agencies.json";
import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.deleteFrom("agency").execute();
    await db.insertInto("agency").values(agencies).execute();

    await sql`SELECT setval(pg_get_serial_sequence('agency', 'id'), (select max(id) from agency))`.execute(db);
}

export async function down(): Promise<void> {}
