import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger } from "@bods-integrated-data/shared/logger";
import { sql } from "kysely";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

void (async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const result = await dbClient
            .deleteFrom("avl_bods")
            .where("valid_until_time", "<", sql<string>`NOW()`)
            .executeTakeFirst();

        logger.info(`AVL BODS cleardown successful: deleted ${result.numDeletedRows} rows`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the AVL BODS cleardown");
        }

        await putMetricData("custom/BODSAVLCleardown", [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
