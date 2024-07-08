import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";
import Pino from "pino";

const logger = Pino();

void (async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    const stage = process.env.STAGE || "";

    try {
        const result = await dbClient
            .deleteFrom("avl_bods")
            .where("valid_until_time", "<", sql<string>`NOW()`)
            .executeTakeFirst();

        logger.info(`AVL BODS cleardown successful: deleted ${result.numDeletedRows} rows`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL BODS cleardown", e);
        }

        await putMetricData(`custom/BODSAVLCleardown-${stage}`, [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
