import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";
import Pino from "pino";

const logger = Pino();

void (async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const result = await dbClient
            .deleteFrom("avl")
            .where("valid_until_time", "<", sql<string>`NOW()`)
            .executeTakeFirst();

        logger.info(`AVL cleardown successful: deleted ${result.numDeletedRows} rows`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL cleardown", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
