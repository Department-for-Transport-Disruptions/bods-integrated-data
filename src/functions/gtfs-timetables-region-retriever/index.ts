import { logger } from "@baselime/lambda-logger";
import { listS3Objects } from "@bods-integrated-data/shared/s3";

export const handler = async () => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Env var missing: BUCKET_NAME must be set.");
        }

        const objects = await listS3Objects({
            Bucket: bucketName,
        });

        const fileNames = objects.Contents;

        logger.info("data", fileNames as Object);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);

            throw e;
        }

        throw e;
    }
};
