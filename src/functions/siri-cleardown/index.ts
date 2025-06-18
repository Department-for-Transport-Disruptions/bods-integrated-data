import { getDatabaseClient, KyselyDb } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import { sql } from "kysely";

let dbClient: KyselyDb;

export const handler = async () => {
    try {
        dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

        const avlResult = await dbClient
            .deleteFrom("avl")
            .where("avl.recorded_at_time", "<", sql<string>`NOW() - INTERVAL '1 day'`)
            .executeTakeFirst();

        const cancellationsResult = await dbClient
            .deleteFrom("avl_cancellation")
            .where("avl_cancellation.recorded_at_time", "<", sql<string>`NOW() - INTERVAL '1 day'`)
            .executeTakeFirst();

        const situationsResult = await dbClient
            .deleteFrom("situation")
            .where("situation.end_time", "<", sql<string>`NOW()`)
            .executeTakeFirst();

        logger.info(
            `AVL cleardown successful: deleted ${avlResult.numDeletedRows} avl rows, ${cancellationsResult.numDeletedRows} cancellations rows, ${situationsResult.numDeletedRows} situations rows`,
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the SIRI cleardown");
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
