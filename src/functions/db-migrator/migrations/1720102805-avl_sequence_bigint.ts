import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .alterColumn("id", (ac) => ac.setDataType("bigint"))
        .execute();

    await db.schema
        .alterTable("avl_bods")
        .alterColumn("id", (ac) => ac.setDataType("bigint"))
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .alterColumn("id", (ac) => ac.setDataType("integer"))
        .execute();

    await db.schema
        .alterTable("avl_bods")
        .alterColumn("id", (ac) => ac.setDataType("integer"))
        .execute();
}
