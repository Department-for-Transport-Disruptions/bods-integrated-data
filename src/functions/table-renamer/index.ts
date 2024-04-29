import { logger } from "@baselime/lambda-logger";
import { Database, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { Kysely, ReferenceExpression, sql } from "kysely";

interface TableKey {
    table: keyof Database;
    newTable: keyof Database;
    key: ReferenceExpression<Database, keyof Database>;
}

// Rename BODS related tables
const tables: TableKey[] = [
    { table: "agency", newTable: "agency_new", key: "id" },
    { table: "calendar", newTable: "calendar_new", key: "id" },
    { table: "calendar_date", newTable: "calendar_date_new", key: "id" },
    { table: "route", newTable: "route_new", key: "id" },
    { table: "stop", newTable: "stop_new", key: "id" },
    { table: "shape", newTable: "shape_new", key: "id" },
    { table: "trip", newTable: "trip_new", key: "id" },
    { table: "frequency", newTable: "frequency_new", key: "id" },
    { table: "stop_time", newTable: "stop_time_new", key: "id" },
    { table: "noc_operator", newTable: "noc_operator_new", key: "noc" },
    { table: "naptan_stop", newTable: "naptan_stop_new", key: "atco_code" },
    { table: "nptg_admin_area", newTable: "nptg_admin_area_new", key: "admin_area_code" },
    { table: "nptg_locality", newTable: "nptg_locality_new", key: "locality_code" },
    { table: "nptg_region", newTable: "nptg_region_new", key: "region_code" },
];

const getMatchingTables = async (dbClient: Kysely<Database>) => {
    const matches = await Promise.all(
        tables.map(async (tableKey) => {
            const { table, newTable, key } = tableKey;

            const [newCount] = await dbClient
                .selectFrom(`${newTable}`)
                .select(dbClient.fn.count(key).as("count"))
                .execute();

            if (newCount.count === 0) return;

            const [currentCount] = await dbClient
                .selectFrom(table)
                .select(dbClient.fn.count(key).as("count"))
                .execute();

            if (!(currentCount.count === 0)) {
                const percentageResult = (Number(newCount.count) / Number(currentCount.count)) * 100;

                if (percentageResult < 80) {
                    logger.warn(
                        `Tables ${table} and ${newTable} have less than an 80% match, percentage match: ${percentageResult}%`,
                    );
                    return;
                }
            }

            return table;
        }),
    );

    return matches.filter(Boolean) as (keyof Database)[];
};

const renameTables = async (tablesToRename: (keyof Database)[], dbClient: Kysely<Database>) => {
    for (const table of tablesToRename) {
        await dbClient.schema.dropTable(`${table}_old`).ifExists().cascade().execute();
        await dbClient.schema.alterTable(table).renameTo(`${table}_old`).execute();
        await dbClient.schema.alterTable(`${table}_new`).renameTo(table).execute();
    }
};

export const handler = async () => {
    const { IS_LOCAL: local } = process.env;
    const isLocal = local === "true";

    const dbClient = await getDatabaseClient(isLocal);

    try {
        const matchingTables = await getMatchingTables(dbClient);

        await renameTables(matchingTables, dbClient);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the Table renamer", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
