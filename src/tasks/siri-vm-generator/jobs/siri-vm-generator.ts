import { randomUUID } from "node:crypto";
import { generateSiriVmAndUploadToS3, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger } from "@bods-integrated-data/shared/logger";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

void (async () => {
    performance.mark("siri-vm-generator-start");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local", true);

    try {
        logger.info("Starting SIRI-VM file generator");

        const { SIRI_VM_BUCKET_NAME, SIRI_VM_SNS_TOPIC_ARN } = process.env;

        if (!SIRI_VM_BUCKET_NAME || !SIRI_VM_SNS_TOPIC_ARN) {
            throw new Error("Missing env vars - SIRI_VM_BUCKET_NAME and SIRI_VM_SNS_TOPIC_ARN must be set");
        }

        const requestMessageRef = randomUUID();
        const avls = await getAvlDataForSiriVm(dbClient);

        await Promise.all([
            generateSiriVmAndUploadToS3(avls, requestMessageRef, SIRI_VM_BUCKET_NAME, SIRI_VM_SNS_TOPIC_ARN),
        ]);

        performance.mark("siri-vm-generator-end");

        const time = performance.measure("siri-vm-generator", "siri-vm-generator-start", "siri-vm-generator-end");

        await putMetricData("custom/SiriVmGenerator", [
            { MetricName: "ExecutionTime", Value: time.duration, Unit: "Milliseconds" },
        ]);

        logger.info("Successfully uploaded SIRI-VM data to S3");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Error generating SIRI-VM file");
        }

        await putMetricData("custom/SiriVmGenerator", [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
