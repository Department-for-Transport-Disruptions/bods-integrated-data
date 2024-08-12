import { Database, KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { ReferenceExpression } from "kysely";

export interface TableKey {
    table: keyof Database;
    newTable: keyof Database;
    key: ReferenceExpression<Database, keyof Database>;
}

// Rename BODS related tables
const databaseTables: TableKey[] = [
    { table: "calendar", newTable: "calendar_new", key: "id" },
    { table: "calendar_date", newTable: "calendar_date_new", key: "id" },
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

export const checkTables = async (dbClient: KyselyDb, tables: TableKey[]) => {
    for (const t of tables) {
        const { table, newTable, key } = t;

        const [newCount] = await dbClient
            .selectFrom(`${newTable}`)
            .select(dbClient.fn.count(key).as("count"))
            .execute();

        if (newCount.count === 0 || newCount.count === "0") {
            throw new Error(`No data found in table ${newTable}`);
        }

        const [currentCount] = await dbClient.selectFrom(table).select(dbClient.fn.count(key).as("count")).execute();

        if (currentCount.count === 0 || currentCount.count === "0") {
            logger.info(`Table ${table} is empty, skipping percentage check`);
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

export const renameTables = async (dbClient: KyselyDb, tables: TableKey[]) => {
    for (const { table, newTable } of tables) {
        await dbClient.schema.dropTable(`${table}_old`).ifExists().cascade().execute();
        await dbClient.schema.alterTable(table).renameTo(`${table}_old`).execute();
        await dbClient.schema.alterTable(newTable).renameTo(table).execute();
    }
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        await checkTables(dbClient, databaseTables);
        await renameTables(dbClient, databaseTables);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the Table renamer", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
