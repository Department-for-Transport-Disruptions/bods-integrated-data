import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl").addColumn("occupancy", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("avl").dropColumn("occupancy").execute();
}
