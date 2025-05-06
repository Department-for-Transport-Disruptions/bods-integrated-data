import { randomUUID } from "node:crypto";
import { generateSiriVmAndUploadToS3, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { generateGtfsRtFeed, mapAvlToGtfsEntity, uploadGtfsRtToS3 } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { errorMapWithDataLogging, logger } from "@bods-integrated-data/shared/logger";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

export const handler = async () => {
    try {
        dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local", true));

        logger.info("Starting SIRI-VM file generator");

        const { GTFS_RT_BUCKET_NAME, SIRI_VM_BUCKET_NAME, SAVE_JSON, SIRI_VM_SNS_TOPIC_ARN } = process.env;

        if (!GTFS_RT_BUCKET_NAME || !SIRI_VM_BUCKET_NAME || !SIRI_VM_SNS_TOPIC_ARN) {
            throw new Error(
                "Missing env vars - GTFS_RT_BUCKET_NAME, SIRI_VM_BUCKET_NAME and SIRI_VM_SNS_TOPIC_ARN must be set",
            );
        }

        const requestMessageRef = randomUUID();
        const avls = await getAvlDataForSiriVm(dbClient);
        const entities = avls.map(mapAvlToGtfsEntity);
        const gtfsRtFeed = generateGtfsRtFeed(entities);

        await Promise.all([
            generateSiriVmAndUploadToS3(avls, requestMessageRef, SIRI_VM_BUCKET_NAME, SIRI_VM_SNS_TOPIC_ARN),
            uploadGtfsRtToS3(GTFS_RT_BUCKET_NAME, "gtfs-rt", gtfsRtFeed, SAVE_JSON === "true"),
        ]);

        const totalAvlCount = avls.length;
        const matchedAvlCount = avls.filter((avl) => avl.route_id && avl.trip_id).length;
        const tflTotalAvlCount = avls.filter((avl) => avl.operator_ref === "TFLO").length;
        const tflMatchedAvlCount = avls.filter(
            (avl) => avl.operator_ref === "TFLO" && avl.route_id && avl.trip_id,
        ).length;

        await putMetricData("custom/SiriVmGenerator", [
            { MetricName: "MatchedAvl", Value: matchedAvlCount },
            { MetricName: "TotalAvl", Value: totalAvlCount },
            { MetricName: "TflMatchedAvl", Value: tflMatchedAvlCount },
            { MetricName: "TflTotalAvl", Value: tflTotalAvlCount },
        ]);

        logger.info("Successfully uploaded SIRI-VM data to S3");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Error generating SIRI-VM file");
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
