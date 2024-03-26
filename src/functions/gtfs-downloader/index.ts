import { fromIni } from "@aws-sdk/credential-providers";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { logger } from "@baselime/lambda-logger";
import { Hash } from "@smithy/hash-node";
import { HttpRequest } from "@smithy/protocol-http";
import { buildQueryString } from "@smithy/querystring-builder";
import { parseUrl } from "@smithy/url-parser";
import { APIGatewayProxyResultV2 } from "aws-lambda";

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
    const { BUCKET_NAME: bucketName } = process.env;

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    const region = "eu-west-2";
    const key = "gtfs.zip";
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    try {
        const presigner = new S3RequestPresigner({
            credentials: fromIni(),
            region,
            sha256: Hash.bind(null, "sha256"),
        });

        const presignedUrl = await presigner.presign(new HttpRequest(parseUrl(url)));

        /**
         * Query params should always be defined even though the query type is nullable.
         * If the presign method resolves with no query params, the built query string
         * will be empty and we can prevent our API redirecting to itself.
         */
        const queryString = buildQueryString(presignedUrl.query!);

        if (!queryString) {
            throw new Error("No presigned query parameters generated");
        }

        const presignedUrlString = `${url}?${queryString}`;

        return {
            statusCode: 302,
            headers: {
                Location: presignedUrlString,
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
