import { logger } from "@baselime/lambda-logger";
import { Avl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { transit_realtime } from "gtfs-realtime-bindings";
import { mapAvlToGtfsEntity } from "./utils";

const getAvlDataFromDatabase = async (): Promise<Avl[]> => {
    const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

    try {
        return await dbClient
            .selectFrom("avl")
            .distinctOn(["operator_ref", "vehicle_ref"])
            .selectAll("avl")
            .orderBy(["operator_ref", "vehicle_ref", "response_time_stamp desc"])
            .execute();
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
        entity: avlData.map(mapAvlToGtfsEntity),
    });

    const data = feed.finish();

    await uploadGtfsRtToS3(bucketName, data);
};
