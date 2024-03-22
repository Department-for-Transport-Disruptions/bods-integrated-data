import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("avl")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("response_time_stamp", "text")
        .addColumn("producer_ref", "text")
        .addColumn("recorded_at_time", "text")
        .addColumn("valid_until_time", "text")
        .addColumn("line_ref", "text")
        .addColumn("direction_ref", "text")
        .addColumn("operator_ref", "text")
        .addColumn("dated_vehicle_journey_ref", "text")
        .addColumn("vehicle_ref", "text")
        .addColumn("longitude", "float8")
        .addColumn("latitude", "float8")
        .addColumn("bearing", "text")
        .addColumn("published_line_name", "text")
        .addColumn("origin_ref", "text")
        .addColumn("destination_ref", "text")
        .addColumn("block_ref", "text")
        .addColumn("data_frame_ref", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("avl").execute();
}
