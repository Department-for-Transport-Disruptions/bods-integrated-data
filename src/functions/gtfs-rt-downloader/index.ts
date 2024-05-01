import { logger } from "@baselime/lambda-logger";
import { getPresignedUrl, getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyResultV2, APIGatewayProxyEventV2 } from "aws-lambda";

const downloadData = async (bucketName: string, key: string): Promise<APIGatewayProxyResultV2> => {
    try {
        const presignedUrl = await getPresignedUrl({ Bucket: bucketName, Key: key }, 3600);

        return {
            statusCode: 302,
            headers: {
                Location: presignedUrl,
            },
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was an error generating a presigned URL for GTFS-RT download", error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};

const retrieveContents = async (bucketName: string, key: string): Promise<APIGatewayProxyResultV2> => {
    try {
        const data = await getS3Object({ Bucket: bucketName, Key: key });

        if (!data.Body) {
            throw new Error("Unable to retrieve GTFS-RT data");
        }

        const encodedBody = await data.Body.transformToString("base64");

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/octet-stream" },
            body: encodedBody,
            isBase64Encoded: true,
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was an error retrieving the contents of the GTFS-RT data", error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const { BUCKET_NAME: bucketName } = process.env;

    const shouldDownload = event.queryStringParameters?.download?.toLowerCase() === "true";
    const key = "gtfs-rt.bin";

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    if (shouldDownload) {
        return await downloadData(bucketName, key);
    }

    return await retrieveContents(bucketName, key);
};
