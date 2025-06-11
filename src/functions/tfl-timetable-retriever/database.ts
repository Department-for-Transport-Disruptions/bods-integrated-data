import { Database, KyselyDb } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";

export const cleardownTables = async (dbClient: KyselyDb) => {
    const tables: (keyof Database)[] = [
        "tfl_block",
        "tfl_block_calendar_day",
        "tfl_destination",
        "tfl_garage",
        "tfl_journey",
        "tfl_journey_drive_time",
        "tfl_journey_wait_time",
        "tfl_line",
        "tfl_operator",
        "tfl_pattern",
        "tfl_route_geometry",
        "tfl_stop_in_pattern",
        "tfl_stop_point",
        "tfl_vehicle",
    ];

    for (const table of tables) {
        await sql`TRUNCATE TABLE ${sql.table(table)} RESTART IDENTITY CASCADE`.execute(dbClient);
    }
};
