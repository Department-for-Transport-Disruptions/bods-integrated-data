import { performance } from "node:perf_hooks";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb, NewAvl, NewBodsAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import {
    generateGtfsRtFeed,
    mapAvlToGtfsEntity,
    matchAvlToTimetables,
} from "@bods-integrated-data/shared/gtfs-rt/utils";
import { logger } from "@bods-integrated-data/shared/logger";
import { getS3Object, putS3Object } from "@bods-integrated-data/shared/s3";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { transit_realtime } from "gtfs-realtime-bindings";
import { parseXml } from "../utils";

const {
    PROCESSOR_FREQUENCY_IN_SECONDS: processorFrequency,
    CLEARDOWN_FREQUENCY_IN_SECONDS: cleardownFrequency,
    GTFS_BUCKET_NAME: gtfsBucketName,
    SIRI_VM_BUCKET_NAME: siriVmBucketName,
    SAVE_JSON: saveJson,
} = process.env;

if (!processorFrequency || !cleardownFrequency || !gtfsBucketName || !siriVmBucketName) {
    throw new Error(
        "Missing env vars - GTFS_BUCKET_NAME, SIRI_VM_BUCKET_NAME, PROCESSOR_FREQUENCY_IN_SECONDS and CLEARDOWN_FREQUENCY_IN_SECONDS must be set",
    );
}

const uploadGtfsRtToS3 = async (gtfsBucketName: string, data: Uint8Array) => {
    try {
        await putS3Object({
            Bucket: gtfsBucketName,
            Key: "gtfs-rt.bin",
            ContentType: "application/octet-stream",
            Body: data,
        });

        if (saveJson === "true") {
            const decodedJson = transit_realtime.FeedMessage.decode(data);

            await putS3Object({
                Bucket: gtfsBucketName,
                Key: "gtfs-rt.json",
                ContentType: "application/json",
                Body: JSON.stringify(decodedJson),
            });
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem uploading GTFS-RT data to S3");
        }

        throw e;
    }
};

const generateGtfs = async (avl: NewBodsAvl[]) => {
    try {
        logger.info("Generating GTFS-RT...");
        const entities = avl.map(mapAvlToGtfsEntity);
        const gtfsRtFeed = generateGtfsRtFeed(entities);

        await uploadGtfsRtToS3(gtfsBucketName, gtfsRtFeed);

        logger.info("GTFS-RT saved to S3 successfully");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error running the GTFS-RT Generator");
        }

        throw e;
    }
};

const uploadToDatabase = async (dbClient: KyselyDb, avls: NewAvl[]) => {
    logger.info("Matching AVL to timetable data...");
    const { avls: enrichedAvls, matchedAvlCount, totalAvlCount } = await matchAvlToTimetables(dbClient, avls);

    await putMetricData("custom/BODSAVLProcessor", [
        {
            MetricName: "MatchedAVL",
            Value: matchedAvlCount,
        },
        {
            MetricName: "TotalAVL",
            Value: totalAvlCount,
        },
    ]);

    const chunks = chunkArray(enrichedAvls, 2000);

    logger.info("Writing AVL data to database...");

    await Promise.all([
        generateGtfs(enrichedAvls),
        ...chunks.map((chunk) =>
            dbClient
                .insertInto("avl_bods")
                .onConflict((oc) =>
                    oc.columns(["vehicle_ref", "operator_ref"]).doUpdateSet((eb) => ({
                        response_time_stamp: eb.ref("excluded.response_time_stamp"),
                        producer_ref: eb.ref("excluded.producer_ref"),
                        recorded_at_time: eb.ref("excluded.recorded_at_time"),
                        valid_until_time: eb.ref("excluded.valid_until_time"),
                        line_ref: eb.ref("excluded.line_ref"),
                        direction_ref: eb.ref("excluded.direction_ref"),
                        operator_ref: eb.ref("excluded.operator_ref"),
                        dated_vehicle_journey_ref: eb.ref("excluded.dated_vehicle_journey_ref"),
                        vehicle_ref: eb.ref("excluded.vehicle_ref"),
                        longitude: eb.ref("excluded.longitude"),
                        latitude: eb.ref("excluded.latitude"),
                        bearing: eb.ref("excluded.bearing"),
                        published_line_name: eb.ref("excluded.published_line_name"),
                        origin_ref: eb.ref("excluded.origin_ref"),
                        destination_ref: eb.ref("excluded.destination_ref"),
                        block_ref: eb.ref("excluded.block_ref"),
                        data_frame_ref: eb.ref("excluded.data_frame_ref"),
                        occupancy: eb.ref("excluded.occupancy"),
                        origin_aimed_departure_time: eb.ref("excluded.origin_aimed_departure_time"),
                        geom: eb.ref("excluded.geom"),
                        route_id: eb.ref("excluded.route_id"),
                        trip_id: eb.ref("excluded.trip_id"),
                    })),
                )
                .values(chunk)
                .execute(),
        ),
    ]);

    logger.info("AVL data written to database successfully...");
};

void (async () => {
    performance.mark("avl-processor-start");

    const stage = process.env.STAGE || "";

    const dbClient = await getDatabaseClient(stage === "local");

    try {
        logger.info("Starting BODS AVL processor");

        const siriVmFile = await getS3Object({
            Bucket: siriVmBucketName,
            Key: "SIRI-VM.xml",
        });

        const xml = await siriVmFile.Body?.transformToString();

        if (!xml) {
            throw new Error("No AVL data found");
        }

        const avls = parseXml(xml);
        await uploadToDatabase(dbClient, avls);

        logger.info("BODS AVL processor successful");
        performance.mark("avl-processor-end");

        const time = performance.measure("avl-processor", "avl-processor-start", "avl-processor-end");

        await putMetricData("custom/BODSAVLProcessor", [
            { MetricName: "ExecutionTime", Value: time.duration, Unit: "Milliseconds" },
        ]);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the BODS AVL Processor");
        }

        await putMetricData("custom/BODSAVLProcessor", [{ MetricName: "Errors", Value: 1 }]);

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
