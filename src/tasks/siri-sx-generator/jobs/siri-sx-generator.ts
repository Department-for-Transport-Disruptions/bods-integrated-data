import { randomUUID } from "node:crypto";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import {
    generateSiriSxAndUploadToS3,
    getSituationsDataForSiriSX,
} from "@bods-integrated-data/shared/cancellations/utils";

void (async () => {
    performance.mark("siri-sx-generator-start");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local", true);

    try {
        logger.info("Starting SIRI-SX file generator");

        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const requestMessageRef = randomUUID();
        const situations = await getSituationsDataForSiriSX(dbClient);

        await generateSiriSxAndUploadToS3(situations, requestMessageRef, bucketName);

        performance.mark("siri-sx-generator-end");

        const time = performance.measure("siri-sx-generator", "siri-sx-generator-start", "siri-sx-generator-end");

        await putMetricData("custom/SiriSxGenerator", [
            { MetricName: "ExecutionTime", Value: time.duration, Unit: "Milliseconds" },
        ]);

        logger.info("Successfully uploaded SIRI-SX data to S3");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Error generating SIRI-SX file");
        }

        await putMetricData("custom/SiriSxGenerator", [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
