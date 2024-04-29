import { logger } from "@baselime/lambda-logger";
import { Database, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export interface TableKey {
    table: keyof Database;
    newTable: keyof Database;
}

// Rename BODS related tables
const databaseTables: TableKey[] = [
    { table: "agency", newTable: "agency_new" },
    { table: "calendar", newTable: "calendar_new" },
    { table: "calendar_date", newTable: "calendar_date_new" },
    { table: "route", newTable: "route_new" },
    { table: "stop", newTable: "stop_new" },
    { table: "shape", newTable: "shape_new" },
    { table: "trip", newTable: "trip_new" },
    { table: "frequency", newTable: "frequency_new" },
    { table: "stop_time", newTable: "stop_time_new" },
    { table: "noc_operator", newTable: "noc_operator_new" },
    { table: "naptan_stop", newTable: "naptan_stop_new" },
    { table: "nptg_admin_area", newTable: "nptg_admin_area_new" },
    { table: "nptg_locality", newTable: "nptg_locality_new" },
    { table: "nptg_region", newTable: "nptg_region_new" },
];

export const checkTables = async (dbClient: Kysely<Database>) => {
    for (const t of databaseTables) {
        const { table, newTable } = t;

        console.log("HELLO");

        const [newCount] = await dbClient
            .selectFrom(`${newTable}`)
            .select(dbClient.fn.countAll().as("count"))
            .execute();

        if (newCount.count === 0) {
            throw new Error(`No data found in table ${newTable}`);
        }

        const [currentCount] = await dbClient.selectFrom(table).select(dbClient.fn.countAll().as("count")).execute();

        if (currentCount.count === 0) {
            continue;
        }

        const percentageResult = (Number(newCount.count) / Number(currentCount.count)) * 100;

        if (percentageResult < 80) {
            throw new Error(
                `Tables ${table} and ${newTable} have less than an 80% match, percentage match: ${percentageResult}%`,
            );
        }

        logger.info(`Table ${newTable} valid with ${newCount.count} rows`);
    }
};

export const renameTables = async (dbClient: Kysely<Database>) => {
    for (const { table, newTable } of databaseTables) {
        await dbClient.schema.dropTable(`${table}_old`).ifExists().cascade().execute();
        await dbClient.schema.alterTable(table).renameTo(`${table}_old`).execute();
        await dbClient.schema.alterTable(newTable).renameTo(table).execute();
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
