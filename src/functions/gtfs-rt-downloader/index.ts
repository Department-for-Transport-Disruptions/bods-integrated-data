import { createServerErrorResponse, createValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import {
    base64Encode,
    generateGtfsRtFeed,
    getAvlDataForGtfs,
    mapAvlToGtfsEntity,
} from "@bods-integrated-data/shared/gtfs-rt/utils";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getPresignedUrl, getS3Object } from "@bods-integrated-data/shared/s3";
import {
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        download: createStringLengthValidation("download").toLowerCase().optional(),
        boundingBox: createBoundingBoxValidation("boundingBox").optional(),
        routeId: createNmTokenArrayValidation("routeId").optional(),
        startTimeBefore: z.coerce.number({ message: "startTimeBefore must be a number" }).optional(),
        startTimeAfter: z.coerce.number({ message: "startTimeAfter must be a number" }).optional(),
    }),
);

const putMetrics = async (
    stage: string,
    download: string | undefined,
    routeId: string | undefined,
    startTimeAfter: number | undefined,
    startTimeBefore: number | undefined,
    boundingBox: string | undefined,
) => {
    await putMetricData(
        `custom/GTFSRTDownloader-${stage}`,
        [
            { name: "download", set: !!download },
            { name: "routeId", set: !!routeId },
            { name: "startTimeAfter", set: !!startTimeAfter },
            { name: "startTimeBefore", set: !!startTimeBefore },
            { name: "boundingBox", set: !!boundingBox },
        ].map((item) => ({
            MetricName: item.name,
            Value: item.set ? 1 : 0,
        })),
    );
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { BUCKET_NAME: bucketName, STAGE: stage } = process.env;
        const key = "gtfs-rt.bin";

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const { download, routeId, startTimeBefore, startTimeAfter, boundingBox } = requestParamsSchema.parse(
            event.queryStringParameters,
        );

        await putMetrics(stage || "", download, routeId, startTimeAfter, startTimeBefore, boundingBox);

        if (routeId || startTimeBefore !== undefined || startTimeAfter !== undefined || boundingBox) {
            const dbClient = await getDatabaseClient(process.env.STAGE === "local");

            try {
                const avlData = await getAvlDataForGtfs(
                    dbClient,
                    routeId,
                    startTimeBefore,
                    startTimeAfter,
                    boundingBox,
                );
                const entities = avlData.map(mapAvlToGtfsEntity);
                const gtfsRtFeed = generateGtfsRtFeed(entities);
                const base64GtfsRtFeed = base64Encode(gtfsRtFeed);

                return {
                    statusCode: 200,
                    headers: { "Content-Type": "application/octet-stream" },
                    body: base64GtfsRtFeed,
                    isBase64Encoded: true,
                };
            } catch (error) {
                if (error instanceof Error) {
                    logger.error("There was an error retrieving the route data", error);
                }

                throw error;
            } finally {
                await dbClient.destroy();
            }
        }

        if (download === "true") {
            const presignedUrl = await getPresignedUrl({ Bucket: bucketName, Key: key }, 3600);

            return {
                statusCode: 302,
                headers: {
                    Location: presignedUrl,
                },
                body: "",
            };
        }

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
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the GTFS-RT downloader endpoint", e);
        }

        return createServerErrorResponse();
    }
};
