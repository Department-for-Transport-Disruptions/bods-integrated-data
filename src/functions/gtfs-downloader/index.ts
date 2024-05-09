import { logger } from "@baselime/lambda-logger";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";
import { txcRegionsSchema } from "@bods-integrated-data/shared/schema/txc.schema";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

export const handler = async (event?: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const { BUCKET_NAME: bucketName } = process.env;

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    let fileName = "all_gtfs.zip";

    if (event?.queryStringParameters?.region) {
        const isValidRegion = txcRegionsSchema.safeParse(event.queryStringParameters.region);

        if (!isValidRegion.success) {
            return {
                statusCode: 400,
                body: "Invalid region code",
            };
        }

        fileName = `${event.queryStringParameters.region.toLowerCase()}_gtfs.zip`;
    }

    try {
        const presignedUrl = await getPresignedUrl({ Bucket: bucketName, Key: fileName }, 3600);

        return {
            statusCode: 302,
            headers: {
                Location: presignedUrl,
            },
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was an error generating a presigned URL for GTFS download", error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};
