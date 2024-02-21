import { getDatabaseClient } from "../../shared";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { FileMigrationProvider, Migrator } from "kysely";
import * as logger from "lambda-log";
import * as path from "path";

export const handler = async () => {
    logger.options.dev = process.env.NODE_ENV !== "production";
    logger.options.debug =
        process.env.ENABLE_DEBUG_LOGS === "true" ||
        process.env.NODE_ENV !== "production";

    logger.options.meta = {
        id: randomUUID(),
    };

    const { ROLLBACK: rollback } = process.env;

    const isRollback = rollback === "true";

    const db = await getDatabaseClient(process.env.IS_LOCAL === "true");

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(__dirname, "./migrations"),
        }),
    });

    const { error, results } = isRollback
        ? await migrator.migrateDown()
        : await migrator.migrateToLatest();

    if (results?.length === 0) {
        logger.info("Nothing to do");
    }

    results?.forEach((it) => {
        if (it.status === "Success") {
            logger.info(
                `${isRollback ? "Rollback of" : "migration "} ${
                    it.migrationName
                }" was executed successfully`
            );
        } else if (it.status === "Error") {
            logger.error(
                `Failed to execute ${
                    isRollback ? "rollback of" : "migration"
                }  " ${it.migrationName}"`
            );
        }
    });

    if (error) {
        logger.error(`Failed to ${isRollback ? "rollback" : "migrate"} `);
        logger.error(error as Error);
        process.exit(1);
    }

    await db.destroy();
};
