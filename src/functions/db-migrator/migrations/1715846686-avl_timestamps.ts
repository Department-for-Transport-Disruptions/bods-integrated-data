import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .alterColumn("response_time_stamp", (ac) =>
            ac.setDataType(sql`TIMESTAMPTZ USING response_time_stamp::timestamptz`),
        )
        .alterColumn("recorded_at_time", (ac) => ac.setDataType(sql`TIMESTAMPTZ USING recorded_at_time::timestamptz`))
        .alterColumn("valid_until_time", (ac) => ac.setDataType(sql`TIMESTAMPTZ USING valid_until_time::timestamptz`))
        .alterColumn("origin_aimed_departure_time", (ac) =>
            ac.setDataType(sql`TIMESTAMPTZ USING origin_aimed_departure_time::timestamptz`),
        )
        .execute();

    await db.schema
        .alterTable("avl_bods")
        .alterColumn("response_time_stamp", (ac) =>
            ac.setDataType(sql`TIMESTAMPTZ USING response_time_stamp::timestamptz`),
        )
        .alterColumn("recorded_at_time", (ac) => ac.setDataType(sql`TIMESTAMPTZ USING recorded_at_time::timestamptz`))
        .alterColumn("valid_until_time", (ac) => ac.setDataType(sql`TIMESTAMPTZ USING valid_until_time::timestamptz`))
        .alterColumn("origin_aimed_departure_time", (ac) =>
            ac.setDataType(sql`TIMESTAMPTZ USING origin_aimed_departure_time::timestamptz`),
        )
        .execute();

    await db.schema
        .createIndex("idx_avl_origin_aimed_departure_time")
        .on("avl")
        .column("origin_aimed_departure_time")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .alterColumn("response_time_stamp", (ac) => ac.setDataType("text"))
        .alterColumn("recorded_at_time", (ac) => ac.setDataType("text"))
        .alterColumn("valid_until_time", (ac) => ac.setDataType("text"))
        .alterColumn("origin_aimed_departure_time", (ac) => ac.setDataType("text"))
        .execute();

    await db.schema
        .alterTable("avl_bods")
        .alterColumn("response_time_stamp", (ac) => ac.setDataType("text"))
        .alterColumn("recorded_at_time", (ac) => ac.setDataType("text"))
        .alterColumn("valid_until_time", (ac) => ac.setDataType("text"))
        .alterColumn("origin_aimed_departure_time", (ac) => ac.setDataType("text"))
        .execute();

    await db.schema.dropIndex("idx_avl_origin_aimed_departure_time").on("avl").execute();
}
