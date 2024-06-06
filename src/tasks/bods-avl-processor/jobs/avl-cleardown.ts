import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";
import Pino from "pino";

const logger = Pino();

void (async () => {
    console.time("avl-cleardown");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const result = await Promise.all([
            dbClient.deleteFrom("avl").where("valid_until_time", "<", sql<string>`NOW()`).executeTakeFirst(),
            dbClient.deleteFrom("avl_bods").where("valid_until_time", "<", sql<string>`NOW()`).executeTakeFirst(),
        ]);

        logger.info(
            `AVL cleardown successful: deleted ${result[0].numDeletedRows} avl rows, ${result[1].numDeletedRows} avl_bods rows`,
        );

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
