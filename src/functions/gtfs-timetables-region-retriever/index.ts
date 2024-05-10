import { logger } from "@baselime/lambda-logger";
import { listS3Objects } from "@bods-integrated-data/shared/s3";
import { notEmpty } from "@bods-integrated-data/shared/utils";

export const handler = async () => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Env var missing: BUCKET_NAME must be set.");
        }

        const objects = await listS3Objects({
            Bucket: bucketName,
        });

        if (!objects) {
            logger.warn("No files found in bucket.");
        }

        const fileNames = objects.Contents?.map((item) => item.Key).filter(notEmpty);

        logger.info("data", fileNames as Object);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error when retrieving GTFS regions.", e);
        }

        throw e;
    }
};
