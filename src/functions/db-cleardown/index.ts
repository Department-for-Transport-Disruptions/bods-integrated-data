import { DEFAULT_DATE_FORMAT } from "@bods-integrated-data/shared/constants";
import { Database, KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { sql } from "kysely";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const cleardownDatabase = async (dbClient: KyselyDb, onlyGtfs = false) => {
    const gtfsTables: (keyof Database)[] = [
        "calendar",
        "calendar_date",
        "stop",
        "shape",
        "trip",
        "frequency",
        "stop_time",
    ];

    const tables: (keyof Database)[] = [
        ...gtfsTables,
        "naptan_stop",
        "naptan_stop_area",
        "noc_operator",
        "nptg_admin_area",
        "nptg_locality",
        "nptg_region",
    ];

    for (const table of onlyGtfs ? gtfsTables : tables) {
        await dbClient.schema.dropTable(`${table}_new`).ifExists().execute();

        await sql`CREATE TABLE ${sql.table(`${table}_new`)} (LIKE ${sql.table(table)} INCLUDING ALL)`.execute(dbClient);
    }
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    logger.info("Starting DB Cleardown");

    const { STAGE: stage, ONLY_GTFS = "false" } = process.env;

    dbClient = dbClient || (await getDatabaseClient(stage === "local"));

    try {
        logger.info("Preparing database...");

        await cleardownDatabase(dbClient, ONLY_GTFS === "true");

        logger.info("Database preparation complete");

        return {
            prefix: getDate().format(DEFAULT_DATE_FORMAT), // For use in step function
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Error running the DB Cleardown");
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
