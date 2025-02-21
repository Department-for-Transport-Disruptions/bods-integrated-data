import { createHttpServerErrorResponse, createHttpValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import {
    base64Encode,
    generateGtfsRtFeed,
    getAvlDataForGtfs,
    mapAvlToGtfsEntity,
} from "@bods-integrated-data/shared/gtfs-rt/utils";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { createBoundingBoxValidation, createNmTokenArrayValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEventV2, Handler } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        boundingBox: createBoundingBoxValidation("boundingBox").optional(),
        routeId: createNmTokenArrayValidation("routeId").optional(),
        startTimeBefore: z.coerce.number({ message: "startTimeBefore must be a number" }).optional(),
        startTimeAfter: z.coerce.number({ message: "startTimeAfter must be a number" }).optional(),
    }),
);

const putMetrics = async (
    routeId: string[] | undefined,
    startTimeAfter: number | undefined,
    startTimeBefore: number | undefined,
    boundingBox: number[] | undefined,
) => {
    await putMetricData(
        "custom/GTFSRTDownloader",
        [
            {
                MetricName: "Invocations",
                Value: 1,
            },
        ],
        [
            { name: "routeId", set: !!routeId?.length },
            { name: "startTimeAfter", set: !!startTimeAfter },
            { name: "startTimeBefore", set: !!startTimeBefore },
            { name: "boundingBox", set: !!boundingBox?.length },
        ]
            .map((item) =>
                item.set
                    ? {
                          Name: "QueryParam",
                          Value: item.name,
                      }
                    : undefined,
            )
            .filter(notEmpty),
    );
};

const isApiGatewayV2Event = (event: unknown | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 =>
    (event as APIGatewayProxyEventV2).version !== undefined;

export const handler: Handler = async (
    event: { queryStringParameters: Record<string, string> } | APIGatewayProxyEventV2,
    context,
) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { BUCKET_NAME: bucketName } = process.env;
        const key = "gtfs-rt.bin";

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const { routeId, startTimeBefore, startTimeAfter, boundingBox } = requestParamsSchema.parse(
            event.queryStringParameters,
        );

        await putMetrics(routeId, startTimeAfter, startTimeBefore, boundingBox);

        if (routeId || startTimeBefore !== undefined || startTimeAfter !== undefined || boundingBox) {
            dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

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

                if (isApiGatewayV2Event(event)) {
                    return {
                        statusCode: 200,
                        headers: { "Content-Type": "application/x-protobuf" },
                        body: base64GtfsRtFeed,
                        isBase64Encoded: true,
                    };
                }

                return base64GtfsRtFeed;
            } catch (e) {
                if (e instanceof Error) {
                    logger.error(e, "There was an error retrieving the route data");
                }

                throw e;
            }
        }

        const data = await getS3Object({ Bucket: bucketName, Key: key });

        if (!data.Body) {
            throw new Error("Unable to retrieve GTFS-RT data");
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
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");

            if (isApiGatewayV2Event(event)) {
                return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
            }
            throw new Error(`[400]: Invalid request - ${e.errors.map((error) => error.message).join(", ")}`);
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the GTFS-RT downloader endpoint");
        }

        if (isApiGatewayV2Event(event)) {
            return createHttpServerErrorResponse();
        }

        throw new Error("[500]: An unexpected error occurred");
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
