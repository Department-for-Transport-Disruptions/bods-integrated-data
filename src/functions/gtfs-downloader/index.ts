import { NoSuchKey } from "@aws-sdk/client-s3";
import { logger } from "@baselime/lambda-logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { Readable } from "stream";

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
    const { BUCKET_NAME: bucketName } = process.env;
    const zippedFilename = "gtfs.zip";

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    let s3Object = null;

    try {
        s3Object = await getS3Object({ Bucket: bucketName, Key: zippedFilename });
    } catch (error) {
        if (error instanceof NoSuchKey) {
            logger.error(`Missing GTFS file: ${zippedFilename}`, error);

            return {
                statusCode: 404,
                body: "No GTFS data found",
            };
        }

        if (error instanceof Error) {
            logger.error(`There was an error retrieving GTFS file: ${zippedFilename}`, error);
        }

        return {
            statusCode: 500,
            body: "An unknown error has occurred. Please try again.",
        };
    }

    if (!s3Object.Body || !(s3Object.Body instanceof Readable)) {
        logger.error(`GTFS file is empty: ${zippedFilename}`);

        return {
            statusCode: 404,
            body: "No GTFS data found",
        };
    }

    // todo: return file as a download instead of a string
    const fileContent = await s3Object.Body.transformToString();

    return {
        statusCode: 200,
        body: fileContent,
    };
};
