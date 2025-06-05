import { Database, KyselyDb } from "@bods-integrated-data/shared/database";
import { ExpressionBuilder, sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";

export const getTflIBusData = async (dbClient: KyselyDb, lineId: string) =>
    dbClient
        .selectFrom("tfl_line")
        .select("tfl_line.id")
        .select((eb: ExpressionBuilder<Database, "tfl_line">) => [
            jsonArrayFrom(
                eb
                    .selectFrom("tfl_pattern")
                    .select(["tfl_pattern.id", "direction"])
                    .select((eb2: ExpressionBuilder<Database, "tfl_pattern">) => [
                        jsonArrayFrom(
                            eb2
                                .selectFrom("tfl_journey")
                                .whereRef("tfl_journey.pattern_id", "=", "tfl_pattern.id")
                                .innerJoin("tfl_block", "tfl_block.id", "tfl_journey.block_id")
                                .select((eb3) => [
                                    "tfl_journey.start_time",
                                    jsonArrayFrom(
                                        eb3
                                            .selectFrom("tfl_block_calendar_day")
                                            .whereRef("tfl_block_calendar_day.block_id", "=", "tfl_block.id")
                                            .select("tfl_block_calendar_day.calendar_day")
                                            .where("tfl_block_calendar_day.block_runs_on_day", "=", 1)
                                            .orderBy("tfl_block_calendar_day.calendar_day"),
                                    ).as("calendar_days"),
                                ])
                                .where("tfl_journey.type", "=", 1)
                                .orderBy("tfl_journey.start_time"),
                        ).as("journeys"),
                        jsonArrayFrom(
                            eb2
                                .selectFrom("tfl_stop_in_pattern")
                                .whereRef("tfl_stop_in_pattern.pattern_id", "=", "tfl_pattern.id")
                                .innerJoin("tfl_stop_point", "tfl_stop_point.id", "tfl_stop_in_pattern.stop_point_id")
                                .select([
                                    "tfl_stop_in_pattern.sequence_no",
                                    "tfl_stop_point.naptan_code as atco_code",
                                    "tfl_stop_point.stop_name as common_name",
                                ])
                                .orderBy("tfl_stop_in_pattern.sequence_no"),
                        ).as("stops"),
                    ])
                    .whereRef("tfl_pattern.contract_line_no", "=", "tfl_line.id"),
            ).as("patterns"),
        ])
        .where("tfl_line.id", "=", lineId)
        .executeTakeFirstOrThrow();

export type TflIBusData = Awaited<ReturnType<typeof getTflIBusData>>;

export const upsertTxcMetadata = async (dbClient: KyselyDb, lineId: string) =>
    dbClient
        .insertInto("tfl_txc_metadata")
        .values({
            line_id: lineId,
            revision: 0,
        })
        .onConflict((oc) =>
            oc.column("line_id").doUpdateSet((eb) => ({
                revision: eb("tfl_txc_metadata.revision", "+", 1),
                modification_datetime: sql`now()`,
            })),
        )
        .returningAll()
        .executeTakeFirstOrThrow();
