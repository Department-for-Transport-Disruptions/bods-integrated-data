import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";
import Pino from "pino";

const logger = Pino();

/* eslint-disable no-console */
void (async () => {
    console.time("avl-cleardown");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const result = await dbClient
            .deleteFrom("avl_bods")
            .where("avl_bods.valid_until_time", "<", sql<string>`NOW()`)
            .execute();

        logger.info(`AVL cleardown successful, ${result[0].numDeletedRows} rows deleted`);

        console.timeEnd("avl-cleardown");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL cleardown", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
