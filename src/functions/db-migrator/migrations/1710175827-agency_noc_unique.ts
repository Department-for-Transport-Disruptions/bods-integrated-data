import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("agency").addUniqueConstraint("agency_noc_unique_constraint", ["noc"]).execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("agency").dropConstraint("agency_noc_unique_constraint").execute();
}
