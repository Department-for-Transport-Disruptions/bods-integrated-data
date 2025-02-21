import { errorMapWithDataLogging, logger } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const isApiGatewayV2Event = (event: unknown | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 =>
    (event as APIGatewayProxyEventV2).version !== undefined;

export const handler = async (event: unknown | APIGatewayProxyEventV2) => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;
        const key = "gtfs-rt-service-alerts.bin";

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const data = await getS3Object({ Bucket: bucketName, Key: key });

        if (!data.Body) {
            throw new Error("Unable to retrieve GTFS-RT service alerts data");
        }
        const encodedBody = await data.Body.transformToString("base64");

        if (isApiGatewayV2Event(event)) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/x-protobuf" },
                body: encodedBody,
                isBase64Encoded: true,
            };
        }

        return encodedBody;
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the GTFS-RT service alerts downloader endpoint");
        }

        throw new Error("[500]: An unexpected error occurred");
    }
};
