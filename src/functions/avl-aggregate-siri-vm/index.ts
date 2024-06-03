import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import {
    AGGREGATED_SIRI_VM_FILE_PATH,
    createSiriVm,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { Avl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { putS3Object } from "@bods-integrated-data/shared/s3";

export const generateSiriVmAndUploadToS3 = async (avls: Avl[], requestMessageRef: string, bucketName: string) => {
    const siri = createSiriVm(avls, requestMessageRef);

    logger.info("Uploading SIRI-VM data to S3");

    await putS3Object({
        Bucket: bucketName,
        Key: AGGREGATED_SIRI_VM_FILE_PATH,
        ContentType: "application/xml",
        Body: siri,
    });
};

export const handler = async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting SIRI-VM generator...");

        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const requestMessageRef = randomUUID();
        const avls = await getAvlDataForSiriVm(dbClient);

        await generateSiriVmAndUploadToS3(avls, requestMessageRef, bucketName);

        logger.info("Successfully uploaded SIRI-VM data to S3");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Error aggregating AVL data", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
