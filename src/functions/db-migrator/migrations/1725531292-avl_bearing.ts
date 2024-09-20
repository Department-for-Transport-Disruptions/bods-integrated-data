import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .alterColumn("bearing", (ac) => ac.setDataType("float8"))
        .execute();

    await db.schema
        .alterTable("avl_bods")
        .alterColumn("bearing", (ac) => ac.setDataType("float8"))
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .alterColumn("bearing", (ac) => ac.setDataType("text"))
        .execute();

    await db.schema
        .alterTable("avl_bods")
        .alterColumn("bearing", (ac) => ac.setDataType("text"))
        .execute();
}
