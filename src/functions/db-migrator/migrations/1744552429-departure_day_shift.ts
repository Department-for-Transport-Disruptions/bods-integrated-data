import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("trip").addColumn("departure_day_shift", "boolean").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("trip").dropColumn("departure_day_shift").execute();
}
