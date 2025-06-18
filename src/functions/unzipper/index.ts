import { Readable } from "node:stream";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { unzip } from "@bods-integrated-data/shared/unzip";
import { S3Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const {
        bucket: { name: bucketName },
        object: { key },
    } = event.Records[0].s3;

    if (!key.endsWith(".zip")) {
        logger.info("Ignoring non-zip file");
        return;
    }

    try {
        const { UNZIPPED_BODS_BUCKET_NAME: unzippedBodsBucketName, UNZIPPED_TNDS_BUCKET_NAME: unzippedTndsBucketName } =
            process.env;

        if (!unzippedBodsBucketName || !unzippedTndsBucketName) {
            throw new Error("Missing env vars - UNZIPPED_BODS_BUCKET_NAME and UNZIPPED_TNDS_BUCKET_NAME must be set");
        }

        if (!bucketName || !key) {
            throw new Error("Bucket name or object key not in event");
        }

        const object = await getS3Object({
            Bucket: bucketName,
            Key: key,
        });

        if (!object.Body || !(object.Body instanceof Readable)) {
            throw new Error("No data in file");
        }

        await unzip(object.Body, bucketName.includes("-tnds-") ? unzippedTndsBucketName : unzippedBodsBucketName, key);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, `Error unzipping file at s3://${bucketName}/${key}`);
        }

        throw e;
    }
};
