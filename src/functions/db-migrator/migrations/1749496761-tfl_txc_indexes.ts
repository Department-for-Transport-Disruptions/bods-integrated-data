import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createIndex("idx_tfl_pattern_contract_line_no")
        .on("tfl_pattern")
        .column("contract_line_no")
        .execute();

    await db.schema.createIndex("idx_tfl_journey_pattern_id").on("tfl_journey").column("pattern_id").execute();

    await db.schema.createIndex("idx_tfl_journey_block_id").on("tfl_journey").column("block_id").execute();

    await db.schema
        .createIndex("idx_tfl_journey_type_start_time")
        .on("tfl_journey")
        .columns(["type", "start_time"])
        .execute();

    await db.schema
        .createIndex("idx_block_calendar_day_block_id_runs_day")
        .on("tfl_block_calendar_day")
        .columns(["block_id", "block_runs_on_day", "calendar_day"])
        .execute();

    await db.schema
        .createIndex("idx_stop_in_pattern_pattern_id_seq")
        .on("tfl_stop_in_pattern")
        .columns(["pattern_id", "sequence_no"])
        .execute();

    await db.schema
        .createIndex("idx_stop_point_naptan_code_not_null")
        .on("tfl_stop_point")
        .column("naptan_code")
        .where("naptan_code", "is not", null)
        .execute();

    await db.schema
        .createIndex("idx_drive_time_journey_stop")
        .on("tfl_journey_drive_time")
        .columns(["journey_id", "stop_in_pattern_from_id"])
        .execute();

    await db.schema
        .createIndex("idx_wait_time_journey_stop")
        .on("tfl_journey_wait_time")
        .columns(["journey_id", "stop_in_pattern_id"])
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_tfl_pattern_contract_line_no").execute();
    await db.schema.dropIndex("idx_tfl_journey_pattern_id").execute();
    await db.schema.dropIndex("idx_tfl_journey_block_id").execute();
    await db.schema.dropIndex("idx_tfl_journey_type_start_time").execute();
    await db.schema.dropIndex("idx_block_calendar_day_block_id_runs_day").execute();
    await db.schema.dropIndex("idx_stop_in_pattern_pattern_id_seq").execute();
    await db.schema.dropIndex("idx_stop_point_naptan_code_not_null").execute();
    await db.schema.dropIndex("idx_drive_time_journey_stop").execute();
    await db.schema.dropIndex("idx_wait_time_journey_stop").execute();
}
