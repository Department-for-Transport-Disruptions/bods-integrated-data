import { randomUUID } from "node:crypto";
import { generateSiriVmAndUploadToS3, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import Pino from "pino";

const logger = Pino();

void (async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting SIRI-VM file generator");

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
            logger.error("Error generating SIRI-VM file", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
