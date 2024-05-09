import { logger } from "@baselime/lambda-logger";
import { generateGtfsRtFeed, getAvlDataForGtfs, mapAvlToGtfsEntity } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { transit_realtime } from "gtfs-realtime-bindings";

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

    const avlData = await getAvlDataForGtfs();
    const entities = avlData.map(mapAvlToGtfsEntity);
    const gtfsRtFeed = generateGtfsRtFeed(entities);

    await uploadGtfsRtToS3(bucketName, gtfsRtFeed);

    if (saveJson === "true") {
        const encodedJson = transit_realtime.FeedMessage.decode(gtfsRtFeed);

        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt.json",
            ContentType: "application/json",
            Body: JSON.stringify(encodedJson),
        });
    }
};
