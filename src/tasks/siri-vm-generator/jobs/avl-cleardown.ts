import { getQueryForLatestAvl } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";

void (async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const latestAvlQuery = getQueryForLatestAvl(dbClient).as("avl_latest");

        const result = await dbClient
            .deleteFrom("avl")
            .using("avl as avl_all")
            .leftJoin(latestAvlQuery, "avl_latest.id", "avl_all.id")
            .whereRef("avl.id", "=", "avl_all.id")
            .where("avl_latest.id", "is", null)
            .executeTakeFirst();

        logger.info(`AVL cleardown successful: deleted ${result.numDeletedRows} rows`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL cleardown", e);
        }

        await putMetricData("custom/SiriVmGeneratorAvlCleardown", [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
