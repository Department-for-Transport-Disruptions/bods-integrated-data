import { logger } from "@baselime/lambda-logger";
import { Avl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { transit_realtime } from "gtfs-realtime-bindings";
import { randomUUID } from "crypto";

const { OccupancyStatus } = transit_realtime.VehiclePosition;

export const getOccupancyStatus = (occupancy: string): transit_realtime.VehiclePosition.OccupancyStatus => {
    switch (occupancy) {
        case "full":
            return OccupancyStatus.FULL;
        case "seatsAvailable":
            return OccupancyStatus.MANY_SEATS_AVAILABLE;
        case "standingAvailable":
            return OccupancyStatus.STANDING_ROOM_ONLY;
        default:
            return OccupancyStatus.MANY_SEATS_AVAILABLE;
    }
};

export const mapAvlToEntity = (avl: Avl): transit_realtime.IFeedEntity => {
    return {
        id: randomUUID(),
        vehicle: {
            occupancyStatus: avl.occupancy ? getOccupancyStatus(avl.occupancy) : null,
            position: {
                bearing: avl.bearing ? parseInt(avl.bearing) : 0,
                latitude: avl.latitude,
                longitude: avl.longitude,
            },
            vehicle: {
                id: avl.vehicle_ref,
                label: avl.vehicle_ref || null,
            },
            trip: {
                // todo in BODS-3757
            },
            timestamp: getDate(avl.recorded_at_time).unix(),
        },
    };
};

export const handler = async () => {
    const { BUCKET_NAME: bucketName } = process.env;

    if (!bucketName) {
        throw new Error("Missing env vars - BUCKET_NAME must be set");
    }

    const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

    try {
        const avl = await dbClient
            .selectFrom("avl")
            .distinctOn(["operator_ref", "vehicle_ref"])
            .selectAll("avl")
            .orderBy(["operator_ref", "vehicle_ref", "response_time_stamp desc"])
            .execute();

        const currentTimestamp = Date.now();

        const feed = transit_realtime.FeedMessage.encode({
            header: {
                gtfsRealtimeVersion: "2.0",
                incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
                timestamp: currentTimestamp,
            },
            entity: avl.map(mapAvlToEntity),
        });

        const data = feed.finish();

        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt",
            ContentType: "application/octet-stream",
            Body: data,
        });
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem with the GTFS-RT processor", error);
        }

        throw error;
    } finally {
        await dbClient.destroy();
    }
};
