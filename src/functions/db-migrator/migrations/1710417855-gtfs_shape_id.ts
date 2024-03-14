import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("shape")
        .addColumn("shape_id", "text", (col) => col.unique())
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("shape").dropColumn("shape_id").execute();
}
