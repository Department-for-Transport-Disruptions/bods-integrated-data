import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient, sql } from "@bods-integrated-data/shared/database";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { transit_realtime } from "gtfs-realtime-bindings";
import { ExtendedAvl } from "./types";
import { mapAvlToGtfsEntity } from "./utils";

/**
 * Get all AVL data from the database, where each row is enriched with a route ID and trip ID.
 * The route ID is determined by comparing the concatenation of the operator and line refs in and AVL against the concatenation
 * of a route's national operator code and short name. The trip ID is determined by comparing this route ID against the corresponding
 * route ID of a trip, as well as comparing the trip's ticket machine journey code against the AVL's dated vehicle journey ref to
 * ensure a unique trip match.
 * @returns An array of AVL data enriched with route and trip IDs
 */
const getAvlDataFromDatabase = async () => {
    const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

    try {
        const queryResult = await sql<ExtendedAvl>`
            SELECT avl.*, routes_with_noc.route_id AS route_id, trip_new.id as trip_id FROM avl
            LEFT OUTER JOIN (
            SELECT route_new.id AS route_id, CONCAT(agency_new.noc, route_new.route_short_name) AS concat_noc_route_short_name FROM route_new
            JOIN agency_new ON route_new.agency_id = agency_new.id
            ) routes_with_noc ON routes_with_noc.concat_noc_route_short_name = CONCAT(avl.operator_ref, avl.line_ref)
            LEFT OUTER JOIN trip_new ON trip_new.route_id = routes_with_noc.route_id AND trip_new.ticket_machine_journey_code = avl.dated_vehicle_journey_ref;
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

const uploadGtfsRtToS3 = async (bucketName: string, data: Uint8Array) => {
    try {
        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt",
            ContentType: "application/octet-stream",
            Body: data,
        });
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem uploading GTFS-RT data to S3", error);
        }

        throw error;
    }
};

export const handler = async () => {
    const { BUCKET_NAME: bucketName } = process.env;

    if (!bucketName) {
        throw new Error("Missing env vars - BUCKET_NAME must be set");
    }

    const avlData = await getAvlDataFromDatabase();

    const feed = transit_realtime.FeedMessage.encode({
        header: {
            gtfsRealtimeVersion: "2.0",
            incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
            timestamp: Date.now(),
        },
        entity: await Promise.all(avlData.map(mapAvlToGtfsEntity)),
    });

    const data = feed.finish();

    await uploadGtfsRtToS3(bucketName, data);
};