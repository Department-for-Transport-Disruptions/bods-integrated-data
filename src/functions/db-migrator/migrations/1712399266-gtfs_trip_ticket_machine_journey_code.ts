import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("trip").addColumn("ticket_machine_journey_code", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("trip").dropColumn("ticket_machine_journey_code").execute();
}
