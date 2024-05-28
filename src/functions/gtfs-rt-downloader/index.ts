import { logger } from "@baselime/lambda-logger";
import { NM_TOKEN_ARRAY_REGEX } from "@bods-integrated-data/shared/constants";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import {
    base64Encode,
    generateGtfsRtFeed,
    getAvlDataForGtfs,
    mapAvlToGtfsEntity,
} from "@bods-integrated-data/shared/gtfs-rt/utils";
import { getPresignedUrl, getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const queryParametersSchema = z.preprocess(
    (val) => Object(val),
    z.object({
        download: z.coerce.string().toLowerCase().optional(),
        routeId: z.coerce.string().regex(NM_TOKEN_ARRAY_REGEX).optional(),
        boundingBox: z.coerce
            .string()
            .regex(/^[-]?[0-9]+(\.[0-9]+)?(,[-]?[0-9]+(\.[0-9]+)?)*$/)
            .optional(),
        startTimeBefore: z.coerce.number().optional(),
        startTimeAfter: z.coerce.number().optional(),
    }),
);

const retrieveRouteData = async (
    dbClient: KyselyDb,
    routeId?: string,
    startTimeBefore?: number,
    startTimeAfter?: number,
    boundingBox?: string,
): Promise<APIGatewayProxyResultV2> => {
    const avlData = await getAvlDataForGtfs(dbClient, routeId, startTimeBefore, startTimeAfter, boundingBox);
    const entities = avlData.map(mapAvlToGtfsEntity);
    const gtfsRtFeed = generateGtfsRtFeed(entities);
    const base64GtfsRtFeed = base64Encode(gtfsRtFeed);

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/octet-stream" },
        body: base64GtfsRtFeed,
        isBase64Encoded: true,
    };
};

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
    const key = "gtfs-rt.bin";

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    const parseResult = queryParametersSchema.safeParse(event.queryStringParameters);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);

        return {
            statusCode: 400,
            body: validationError.message,
        };
    }

    const { download, routeId, startTimeBefore, startTimeAfter, boundingBox } = parseResult.data;

    if (routeId || startTimeBefore !== undefined || startTimeAfter != undefined || boundingBox) {
        const dbClient = await getDatabaseClient(process.env.STAGE === "local");

        if (boundingBox && boundingBox.split(",").length !== 4) {
            return {
                statusCode: 400,
                body: "Bounding box must contain 4 items; minLongitude, minLatitude, maxLongitude and maxLatitude",
            };
        }

        try {
            return await retrieveRouteData(dbClient, routeId, startTimeBefore, startTimeAfter, boundingBox);
        } catch (error) {
            if (error instanceof Error) {
                logger.error("There was an error retrieving the route data", error);
            }

            return {
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            };
        } finally {
            await dbClient.destroy();
        }
    }

    if (download === "true") {
        return await downloadData(bucketName, key);
    }

    return await retrieveContents(bucketName, key);
};
