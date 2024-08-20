import { createServerErrorResponse } from "@bods-integrated-data/shared/api";
import { logger } from "@bods-integrated-data/shared/logger";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyResult } from "aws-lambda";

export const handler = async (): Promise<APIGatewayProxyResult> => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;
        const key = "gtfs-rt-service-alerts.bin";

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const presignedUrl = await getPresignedUrl({ Bucket: bucketName, Key: key }, 3600);

        return {
            statusCode: 302,
            headers: {
                Location: presignedUrl,
            },
            body: "",
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the GTFS-RT service alerts downloader endpoint", e);
        }

        return createServerErrorResponse();
    }
};
