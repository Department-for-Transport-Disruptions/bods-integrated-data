import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient, sql } from "@bods-integrated-data/shared/database";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { transit_realtime } from "gtfs-realtime-bindings";
import { ExtendedAvl } from "./types";
import { mapAvlToGtfsEntity } from "./utils";

/**
 * Get all AVL data from the database along with a route ID and trip ID for each AVL row.
 * The route ID is determined by looking up the route that matches the concatenation of the
 * AVL's operator and line refs with the concatenation of the route's national operator code
 * and short name. The trip ID is then determined by looking up the trip with this route ID
 * and that matches the trip's ticket machine journey code with the AVL's dated vehicle
 * journey ref, to ensure a single trip is matched. Note that it is possible for no matching
 * route ID or trip ID to be found.
 * @returns An array of AVL data enriched with route and trip IDs
 */
const getAvlDataFromDatabase = async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const queryResult = await sql<ExtendedAvl>`
            SELECT DISTINCT ON (avl.operator_ref, avl.vehicle_ref) avl.*, routes_with_noc.route_id AS route_id, trip.id as trip_id FROM avl
            LEFT OUTER JOIN (
                SELECT route.id AS route_id, CONCAT(agency.noc, route.route_short_name) AS concat_noc_route_short_name FROM route
                JOIN agency ON route.agency_id = agency.id
            ) routes_with_noc ON routes_with_noc.concat_noc_route_short_name = CONCAT(avl.operator_ref, avl.line_ref)
            LEFT OUTER JOIN trip ON trip.route_id = routes_with_noc.route_id AND trip.ticket_machine_journey_code = avl.dated_vehicle_journey_ref
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

const uploadGtfsRtToS3 = async (bucketName: string, data: Uint8Array) => {
    try {
        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt.bin",
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
    const { BUCKET_NAME: bucketName, SAVE_JSON: saveJson } = process.env;

    if (!bucketName) {
        throw new Error("Missing env vars - BUCKET_NAME must be set");
    }

    const avlData = await getAvlDataFromDatabase();

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

    await uploadGtfsRtToS3(bucketName, data);

    if (saveJson === "true") {
        const encodedJson = transit_realtime.FeedMessage.decode(data);

        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt.json",
            ContentType: "application/json",
            Body: JSON.stringify(encodedJson),
        });
    }
};
