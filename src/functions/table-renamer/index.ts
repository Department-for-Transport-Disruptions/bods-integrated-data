import { logger } from "@baselime/lambda-logger";
import { Database, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { Kysely, ReferenceExpression, sql } from "kysely";

interface TableKey {
    table: keyof Database;
    key: ReferenceExpression<Database, keyof Database>;
}

// Rename BODS related tables
const tables: TableKey[] = [
    { table: "agency", key: "id" },
    { table: "calendar", key: "id" },
    { table: "calendar_date", key: "id" },
    { table: "route", key: "id" },
    { table: "stop", key: "id" },
    { table: "shape", key: "id" },
    { table: "trip", key: "id" },
    { table: "frequency", key: "id" },
    { table: "stop_time", key: "id" },
    { table: "noc_operator", key: "noc" },
    { table: "naptan_stop", key: "atco_code" },
];

const getMatchingTables = async (dbClient: Kysely<Database>) => {
    const matches = await Promise.all(
        tables.map(async (tableKey) => {
            const { table, key } = tableKey;
            const pk = key as string;
            const newTable = `${table}_new`;

            const query = await sql<{ percentage_matching: number }>`
                WITH total_rows AS (
                SELECT COUNT(*)::FLOAT AS total from ${sql.id(table)}
                ),
                matching_rows AS (
                SELECT COUNT(DISTINCT ${sql.id(table)}.${sql.ref(pk)})::FLOAT AS matching
                FROM ${sql.id(table)}
                JOIN ${sql.id(newTable)} ON ${sql.id(table)}.${sql.id(pk)} = ${sql.id(newTable)}.${sql.id(pk)}
                )
                SELECT (matching_rows.matching / total_rows.total) * 100 AS percentage_matching
                FROM matching_rows, total_rows;
                `.execute(dbClient);

            if (query.rows.length < 0) {
                throw new Error(`Error attempting to match table ${table} with key ${pk}`);
            }

            if (query.rows[0].percentage_matching < 80) {
                logger.warn(
                    `Tables ${table} and ${newTable} have less than an 80% match, percentage match: ${query.rows[0].percentage_matching}%`,
                );
                return;
            }

            return table;
        }),
    );

    return matches.filter(Boolean) as (keyof Database)[];
};

const renameTables = async (tablesToRename: (keyof Database)[], dbClient: Kysely<Database>) => {
    for (const table of tablesToRename) {
        await dbClient.schema.dropTable(`${table}_old`).ifExists().execute();
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
