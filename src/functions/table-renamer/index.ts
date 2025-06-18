import { Database, getDatabaseClient, KyselyDb } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

export type TableKeyBase = {
    table: keyof Database;
};

export type TableKeyBasic = TableKeyBase & {
    type: "basic";
};

export type TableKeyWithRequiredPercentage = TableKeyBase & {
    type: "withPercentage";
    currentCount: number;
    newCount: number;
    requiredPercentage: number;
};

export type TableKey = TableKeyBasic | TableKeyWithRequiredPercentage;

export const getCount = async <T extends keyof Database, C extends keyof Database[T] & string>(
    dbClient: KyselyDb,
    table: T,
    column: C,
) => {
    const { table: dynTable, ref } = dbClient.dynamic;

    const [count] = await dbClient
        .selectFrom(dynTable(table).as("newTable"))
        .select(dbClient.fn.count(ref(column)).as("count"))
        .execute();

    return Number(count);
};

const getTableKey = async <T extends keyof Database, C extends keyof Database[T] & string>(
    dbClient: KyselyDb,
    table: T,
    newTable?: T,
    requiredPercentage?: number,
    countKey?: C,
): Promise<TableKey> => {
    if (requiredPercentage !== undefined && countKey !== undefined && newTable !== undefined) {
        return {
            type: "withPercentage",
            table,
            currentCount: await getCount(dbClient, table, countKey),
            newCount: await getCount(dbClient, newTable, countKey),
            requiredPercentage: 70,
        };
    }

    return {
        type: "basic",
        table,
    };
};

export const checkTables = async (dbClient: KyselyDb) => {
    // Rename BODS related tables
    const databaseTables: TableKey[] = [
        await getTableKey(dbClient, "calendar", "calendar_new", 70, "id"),
        await getTableKey(dbClient, "calendar_date", "calendar_date_new", 70, "id"),
        await getTableKey(dbClient, "stop", "stop_new", 70, "id"),
        await getTableKey(dbClient, "shape", "shape_new", 70, "id"),
        await getTableKey(dbClient, "trip", "trip_new", 70, "id"),
        await getTableKey(dbClient, "frequency", "frequency_new", 70, "id"),
        await getTableKey(dbClient, "stop_time", "stop_time_new", 70, "id"),
        await getTableKey(dbClient, "noc_operator"),
        await getTableKey(dbClient, "naptan_stop"),
        await getTableKey(dbClient, "naptan_stop_area"),
        await getTableKey(dbClient, "nptg_admin_area"),
        await getTableKey(dbClient, "nptg_locality"),
        await getTableKey(dbClient, "nptg_region"),
    ];

    for (const t of databaseTables) {
        if (t.type === "basic") {
            continue;
        }

        const { table, currentCount, newCount } = t;

        if (newCount === 0) {
            throw new Error(`No data found in table ${table}_new`);
        }

        if (currentCount === 0) {
            logger.info(`Table ${table} is empty, skipping percentage check`);
            continue;
        }

        const percentageResult = (newCount / currentCount) * 100;

        if (t.requiredPercentage && percentageResult < t.requiredPercentage) {
            throw new Error(
                `Tables ${table} and ${table}_new have less than an ${t.requiredPercentage}% match, percentage match: ${percentageResult}%`,
            );
        }

        logger.info(`Table ${table}_new valid with ${newCount} rows`);
    }

    return databaseTables;
};

export const renameTables = async (dbClient: KyselyDb, tables: TableKey[]) => {
    for (const { table } of tables) {
        await dbClient.schema.dropTable(`${table}_old`).ifExists().cascade().execute();
        await dbClient.schema.alterTable(table).renameTo(`${table}_old`).execute();
        await dbClient.schema.alterTable(`${table}_new`).renameTo(table).execute();
    }
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        const databaseTables = await checkTables(dbClient);
        await renameTables(dbClient, databaseTables);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the Table renamer");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
