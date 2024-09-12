import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import { sql } from "kysely";

void (async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const result = await dbClient
            .deleteFrom("avl")
            .where("avl.recorded_at_time", "<", sql<string>`NOW() - INTERVAL '1 day'`)
            .executeTakeFirst();

        logger.info(`AVL cleardown successful: deleted ${result.numDeletedRows} rows`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the AVL cleardown");
        }

        await putMetricData("custom/SiriVmGeneratorAvlCleardown", [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
