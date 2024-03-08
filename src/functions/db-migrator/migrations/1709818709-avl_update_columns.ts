import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .addColumn("dataFrameRef", "varchar(255)")
        .dropColumn("delay")
        .dropColumn("isCompleteStopSequence")
        .dropColumn("dataSource")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .dropColumn("dataFrameRef")
        .addColumn("delay", "text")
        .addColumn("isCompleteStopSequence", "text")
        .addColumn("dataSource", "text")
        .execute();
}
