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

const isTableEmpty = async (dbClient: Kysely<Database>, table: keyof Database) => {
    // Count returns a string
    const queryResult = await dbClient
        .selectFrom(table)
        .select([(i) => i.fn.countAll<string>().as("count")])
        .execute();

    return queryResult[0].count === "0";
};

const checkTables = async (dbClient: Kysely<Database>) => {
    for (const t of tables) {
        const { table, newTable, key } = t;
        const pk = key as string;

        const newTableIsEmpty = await isTableEmpty(dbClient, newTable);

        if (newTableIsEmpty) {
            throw new Error(`Table ${table} is empty`);
        }

        const mainTableIsEmpty = await isTableEmpty(dbClient, table);

        if (!mainTableIsEmpty) {
            const query = await sql<{ percentage_matching: number }>`
                WITH total_rows AS (
                    SELECT COUNT(*)::FLOAT AS total from ${sql.table(table)}
                ),
                new_total_rows AS (
                    SELECT COUNT(*)::FLOAT AS total from ${sql.table(newTable)}
                )
                SELECT (new_total_rows.total / total_rows.total) * 100 AS percentage_matching
                FROM matching_rows, total_rows;
                `.execute(dbClient);

            if (query.rows.length < 0) {
                throw new Error(`Error attempting to match table ${table} with key ${pk}`);
            }

            if (query.rows[0].percentage_matching < 80) {
                throw new Error(
                    `Tables ${table} and ${newTable} have less than an 80% match, percentage match: ${query.rows[0].percentage_matching}%`,
                );
            }
        }
    }
};

const renameTables = async (dbClient: Kysely<Database>) => {
    for (const t of tables) {
        await dbClient.schema.dropTable(`${t.table}_old`).ifExists().execute();
        await dbClient.schema.alterTable(t.table).renameTo(`${t.table}_old`).execute();
        await dbClient.schema.alterTable(t.newTable).renameTo(t.table).execute();
    }
};

export const handler = async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        await checkTables(dbClient);

        await renameTables(dbClient);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the Table renamer", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
