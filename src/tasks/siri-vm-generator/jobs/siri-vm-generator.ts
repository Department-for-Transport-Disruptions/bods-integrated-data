import { randomUUID } from "node:crypto";
import {
    GENERATED_SIRI_VM_FILE_PATH,
    GENERATED_SIRI_VM_TFL_FILE_PATH,
    createSiriVm,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { tflOperatorRef } from "@bods-integrated-data/shared/constants";
import { Avl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import Pino from "pino";

const logger = Pino();

export const generateSiriVmAndUploadToS3 = async (avls: Avl[], requestMessageRef: string, bucketName: string) => {
    const responseTime = getDate();
    const siriVm = createSiriVm(avls, requestMessageRef, responseTime);
    const siriVmTfl = createSiriVm(
        avls.filter((avl) => avl.operator_ref === tflOperatorRef),
        requestMessageRef,
        responseTime,
    );

    logger.info("Uploading SIRI-VM data to S3");

    await Promise.all([
        putS3Object({
            Bucket: bucketName,
            Key: GENERATED_SIRI_VM_FILE_PATH,
            ContentType: "application/xml",
            Body: siriVm,
        }),
        putS3Object({
            Bucket: bucketName,
            Key: GENERATED_SIRI_VM_TFL_FILE_PATH,
            ContentType: "application/xml",
            Body: siriVmTfl,
        }),
    ]);
};

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
