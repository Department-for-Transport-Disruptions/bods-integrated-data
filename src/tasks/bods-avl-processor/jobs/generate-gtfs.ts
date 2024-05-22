/* eslint-disable no-console */
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { generateGtfsRtFeed, getAvlDataForGtfs, mapAvlToGtfsEntity } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { transit_realtime } from "gtfs-realtime-bindings";
import Pino from "pino";

const logger = Pino();

const { BUCKET_NAME: bucketName, SAVE_JSON: saveJson } = process.env;

if (!bucketName) {
    throw new Error(
        "Missing env vars - BUCKET_NAME, PROCESSOR_FREQUENCY_IN_SECONDS and CLEARDOWN_FREQUENCY_IN_SECONDS must be set",
    );
}

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

void (async () => {
    console.time("gtfsgenerate");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local", true);

    try {
        logger.info("Retrieving AVL from database...");
        const avlData = await getAvlDataForGtfs(dbClient);

        logger.info("Generating GTFS-RT...");
        const entities = avlData.map(mapAvlToGtfsEntity);
        const gtfsRtFeed = generateGtfsRtFeed(entities);

        await uploadGtfsRtToS3(bucketName, gtfsRtFeed);

        if (saveJson === "true") {
            const decodedJson = transit_realtime.FeedMessage.decode(gtfsRtFeed);

            await putS3Object({
                Bucket: bucketName,
                Key: "gtfs-rt.json",
                ContentType: "application/json",
                Body: JSON.stringify(decodedJson),
            });
        }

        console.timeEnd("gtfsgenerate");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error running the GTFS-RT Generator", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
