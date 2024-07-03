import { randomUUID } from "node:crypto";
import { generateSiriVmAndUploadToS3, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import Pino from "pino";

const logger = Pino();

void (async () => {
    performance.mark("siri-vm-generator-start");

    const stage = process.env.STAGE || "";

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting SIRI-VM file generator");

        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const requestMessageRef = randomUUID();
        const avls = await getAvlDataForSiriVm(dbClient);

        logger.info("avlData", avls);

        await generateSiriVmAndUploadToS3(avls, requestMessageRef, bucketName, stage);

        performance.mark("siri-vm-generator-end");

        const time = performance.measure("siri-vm-generator", "siri-vm-generator-start", "siri-vm-generator-end");

        await putMetricData(`custom/SiriVmGenerator-${stage}`, [
            { MetricName: "ExecutionTime", Value: time.duration, Unit: "Milliseconds" },
        ]);

        logger.info("Successfully uploaded SIRI-VM data to S3");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Error generating SIRI-VM file", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
