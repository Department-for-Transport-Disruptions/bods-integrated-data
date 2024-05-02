import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient, sql } from "@bods-integrated-data/shared/database";
import { ExtendedAvl } from "@bods-integrated-data/shared/gtfs-rt/types";
import { mapAvlToGtfsEntity } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { getPresignedUrl, getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { transit_realtime } from "gtfs-realtime-bindings";

export const getRouteData = async (routeIds: string[]) => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const queryResult = await sql<ExtendedAvl>`
            SELECT DISTINCT ON (avl.operator_ref, avl.vehicle_ref) avl.*, routes_with_noc.route_id AS route_id, trip.id as trip_id FROM avl
            LEFT OUTER JOIN (
                SELECT route.id AS route_id, CONCAT(agency.noc, route.route_short_name) AS concat_noc_route_short_name FROM route
                JOIN agency ON route.agency_id = agency.id
            ) routes_with_noc ON routes_with_noc.concat_noc_route_short_name = CONCAT(avl.operator_ref, avl.line_ref)
            LEFT OUTER JOIN trip ON trip.route_id = routes_with_noc.route_id AND trip.ticket_machine_journey_code = avl.dated_vehicle_journey_ref
            WHERE routes_with_noc.route_id IN (${routeIds.join(",")})
            ORDER BY avl.operator_ref, avl.vehicle_ref, avl.response_time_stamp DESC
            `.execute(dbClient);

        return queryResult.rows;
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem getting AVL data from the database", error);
        }

        throw error;
    } finally {
        await dbClient.destroy();
    }
};

export const retrieveRouteData = async (routeIds: string[]): Promise<APIGatewayProxyResultV2> => {
    try {
        const avlData = await getRouteData(routeIds);

        if (avlData.length === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: `No routes found that match Id(s) ${routeIds.join(",")}`,
            };
        }
        const message = {
            header: {
                gtfsRealtimeVersion: "2.0",
                incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
                timestamp: Date.now(),
            },
            entity: avlData.map(mapAvlToGtfsEntity),
        };

        const feed = transit_realtime.FeedMessage.encode(message);
        const data = feed.finish();

        const encodedData = Buffer.from(data).toString("base64");

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/octet-stream" },
            body: encodedData,
            isBase64Encoded: true,
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was an error retrieving the route data", error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
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

    const shouldDownload = event.queryStringParameters?.download?.toLowerCase() === "true";
    const routeIds = event.queryStringParameters?.routeId;
    const key = "gtfs-rt.bin";

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    if (routeIds) {
        return await retrieveRouteData(routeIds.split(","));
    }

    if (shouldDownload) {
        return await downloadData(bucketName, key);
    }

    return await retrieveContents(bucketName, key);
};
