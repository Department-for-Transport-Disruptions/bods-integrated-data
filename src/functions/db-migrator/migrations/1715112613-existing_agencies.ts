import agencies from "@bods-integrated-data/shared/data/agencies.json";
import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.deleteFrom("agency").execute();
    await db.insertInto("agency").values(agencies).execute();
}

export async function down(): Promise<void> {}
