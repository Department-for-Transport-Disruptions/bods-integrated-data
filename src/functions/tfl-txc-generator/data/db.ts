import { Database, KyselyDb } from "@bods-integrated-data/shared/database";
import { ExpressionBuilder, NotNull, sql } from "kysely";
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
                                    "tfl_block.block_no",
                                    jsonArrayFrom(
                                        eb3
                                            .selectFrom("tfl_block_calendar_day")
                                            .whereRef("tfl_block_calendar_day.block_id", "=", "tfl_block.id")
                                            .select("tfl_block_calendar_day.calendar_day")
                                            .where("tfl_block_calendar_day.block_runs_on_day", "=", 1)
                                            .orderBy("tfl_block_calendar_day.calendar_day"),
                                    ).as("calendar_days"),
                                    jsonArrayFrom(
                                        eb3
                                            .selectFrom("tfl_journey_drive_time")
                                            .whereRef("tfl_journey_drive_time.journey_id", "=", "tfl_journey.id")
                                            .leftJoin("tfl_journey_wait_time", (join) =>
                                                join
                                                    .onRef(
                                                        "tfl_journey_wait_time.stop_in_pattern_id",
                                                        "=",
                                                        "tfl_journey_drive_time.stop_in_pattern_from_id",
                                                    )
                                                    .onRef("tfl_journey_wait_time.journey_id", "=", "tfl_journey.id"),
                                            )
                                            .innerJoin(
                                                "tfl_stop_in_pattern as from_stop_in_pattern",
                                                "from_stop_in_pattern.id",
                                                "tfl_journey_drive_time.stop_in_pattern_from_id",
                                            )
                                            .innerJoin(
                                                "tfl_stop_in_pattern as to_stop_in_pattern",
                                                "to_stop_in_pattern.id",
                                                "tfl_journey_drive_time.stop_in_pattern_to_id",
                                            )
                                            .innerJoin(
                                                "tfl_stop_point as from_stop",
                                                "from_stop.id",
                                                "from_stop_in_pattern.stop_point_id",
                                            )
                                            .innerJoin(
                                                "tfl_stop_point as to_stop",
                                                "to_stop.id",
                                                "to_stop_in_pattern.stop_point_id",
                                            )
                                            .select([
                                                "from_stop.naptan_code as from_atco_code",
                                                "from_stop_in_pattern.timing_point_code as from_timing_point_code",
                                                "to_stop.naptan_code as to_atco_code",
                                                "to_stop_in_pattern.timing_point_code as to_timing_point_code",
                                                "tfl_journey_drive_time.drive_time",
                                                "tfl_journey_wait_time.wait_time",
                                            ])
                                            .where("from_stop.naptan_code", "is not", null)
                                            .where("to_stop.naptan_code", "is not", null)
                                            .$narrowType<{
                                                from_atco_code: NotNull;
                                                to_atco_code: NotNull;
                                            }>()
                                            .orderBy([
                                                "from_stop_in_pattern.sequence_no asc",
                                                "to_stop_in_pattern.sequence_no asc",
                                            ]),
                                    ).as("stops"),
                                ])
                                .where("tfl_journey.type", "=", 1)
                                .orderBy("tfl_journey.start_time"),
                        ).as("journeys"),
                        jsonArrayFrom(
                            eb2
                                .selectFrom("tfl_stop_in_pattern")
                                .whereRef("tfl_stop_in_pattern.pattern_id", "=", "tfl_pattern.id")
                                .innerJoin("tfl_stop_point", "tfl_stop_point.id", "tfl_stop_in_pattern.stop_point_id")
                                .leftJoin("tfl_destination", "tfl_destination.id", "tfl_stop_in_pattern.destination_id")
                                .select([
                                    "tfl_stop_in_pattern.sequence_no",
                                    "tfl_stop_point.naptan_code as atco_code",
                                    "tfl_stop_point.stop_name as common_name",
                                    "tfl_destination.short_destination_name",
                                    "tfl_stop_in_pattern.timing_point_code",
                                ])
                                .where("tfl_stop_point.naptan_code", "is not", null)
                                .$narrowType<{ atco_code: NotNull }>()
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
