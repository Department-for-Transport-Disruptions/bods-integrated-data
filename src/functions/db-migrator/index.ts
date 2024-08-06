import { promises as fs } from "node:fs";
import * as path from "node:path";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { FileMigrationProvider, Migrator } from "kysely";

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { ROLLBACK: rollback } = process.env;

    const isRollback = rollback === "true";

    const db = await getDatabaseClient(process.env.STAGE === "local");

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(__dirname, "./migrations"),
        }),
    });

    const { error, results } = isRollback ? await migrator.migrateDown() : await migrator.migrateToLatest();

    if (results) {
        if (results.length === 0) {
            logger.info("Nothing to do");
        }

        for (const result of results) {
            if (result.status === "Success") {
                logger.info(
                    `${isRollback ? "Rollback of" : "migration "} ${result.migrationName}" was executed successfully`,
                );
            } else if (result.status === "Error") {
                logger.error(
                    `Failed to execute ${isRollback ? "rollback of" : "migration"}  " ${result.migrationName}"`,
                );
            }
        }
    }

    await db.destroy();

    if (error) {
        logger.error(`Failed to ${isRollback ? "rollback" : "migrate"}`, error);
        process.exit(1);
    }

    await db.destroy();
};
