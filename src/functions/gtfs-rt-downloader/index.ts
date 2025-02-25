import { gzipSync } from "node:zlib";
import { createHttpServerErrorResponse, createHttpValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { generateGtfsRtFeed, getAvlDataForGtfs, mapAvlToGtfsEntity } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { FileCache } from "@bods-integrated-data/shared/utils";
import { createBoundingBoxValidation, createNmTokenArrayValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEventV2, Handler } from "aws-lambda";
import { hasher } from "node-object-hash";
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

const isApiGatewayV2Event = (event: unknown | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 =>
    (event as APIGatewayProxyEventV2).version !== undefined;

const CACHE_DIR = "/tmp/cache";

export const handler: Handler = async (
    event: { queryStringParameters: Record<string, string> } | APIGatewayProxyEventV2,
    context,
) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { BUCKET_NAME: bucketName, ENABLE_CACHE: enableCache = "true" } = process.env;
        const key = "gtfs-rt.bin";

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const queryParams = requestParamsSchema.parse(event.queryStringParameters);

        const { routeId, startTimeBefore, startTimeAfter, boundingBox } = queryParams;

        if (routeId || startTimeBefore !== undefined || startTimeAfter !== undefined || boundingBox) {
            const keyHash = hasher().hash(queryParams);

            const cache = enableCache === "true" ? new FileCache(CACHE_DIR, 5, 4) : null;

            const cachedResponse = cache ? await cache.get(keyHash) : null;

            if (cachedResponse) {
                if (isApiGatewayV2Event(event)) {
                    return {
                        statusCode: 200,
                        headers: { "Content-Type": "application/x-protobuf", "Content-Encoding": "gzip" },
                        body: cachedResponse,
                        isBase64Encoded: true,
                    };
                }

                return cachedResponse;
            }

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

                const gtfs = gzipSync(gtfsRtFeed, {
                    level: 2,
                }).toString("base64");

                cache && (await cache.set(keyHash, gtfs));

                if (isApiGatewayV2Event(event)) {
                    return {
                        statusCode: 200,
                        headers: { "Content-Type": "application/x-protobuf", "Content-Encoding": "gzip" },
                        body: gtfs,
                        isBase64Encoded: true,
                    };
                }

                return gtfs;
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

        const body = await data.Body.transformToByteArray();

        const gtfs = gzipSync(body, {
            level: 2,
        }).toString("base64");

        if (isApiGatewayV2Event(event)) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/x-protobuf", "Content-Encoding": "gzip" },
                body: gtfs,
                isBase64Encoded: true,
            };
        }

        return gtfs;
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
