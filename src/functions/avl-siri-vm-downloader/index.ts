import { logger } from "@baselime/lambda-logger";
import { AGGREGATED_SIRI_VM_FILE_PATH } from "@bods-integrated-data/shared/avl/utils";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";

export const handler = async () => {
    const { BUCKET_NAME: bucketName } = process.env;
    const key = AGGREGATED_SIRI_VM_FILE_PATH;

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    try {
        const presignedUrl = await getPresignedUrl(
            {
                Bucket: bucketName,
                Key: key,
                ResponseContentDisposition: "inline",
                ResponseContentType: "application/xml",
            },
            3600,
        );

        return {
            statusCode: 302,
            headers: {
                Location: presignedUrl,
            },
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`There was an error retrieving SIRI-VM data with key: ${key}`, error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};
