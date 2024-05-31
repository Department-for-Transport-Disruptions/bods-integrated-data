import { Stream } from "stream";
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import {
    generateGtfsRtFeed,
    mapAvlToGtfsEntity,
    matchAvlToTimetables,
} from "@bods-integrated-data/shared/gtfs-rt/utils";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { siriSchemaTransformed } from "@bods-integrated-data/shared/schema/avl.schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios, { AxiosResponse } from "axios";
import { XMLParser } from "fast-xml-parser";
import { transit_realtime } from "gtfs-realtime-bindings";
import Pino from "pino";
import { Entry, Parse } from "unzipper";

const logger = Pino();

const {
    PROCESSOR_FREQUENCY_IN_SECONDS: processorFrequency,
    CLEARDOWN_FREQUENCY_IN_SECONDS: cleardownFrequency,
    BUCKET_NAME: bucketName,
    SAVE_JSON: saveJson,
} = process.env;

if (!processorFrequency || !cleardownFrequency || !bucketName) {
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
            logger.error(error);
        }

        logger.error("There was a problem uploading GTFS-RT data to S3");

        throw error;
    }
};

const generateGtfs = async (avl: NewAvl[]) => {
    try {
        logger.info("Generating GTFS-RT...");
        const entities = avl.map(mapAvlToGtfsEntity);
        const gtfsRtFeed = generateGtfsRtFeed(entities);

        await uploadGtfsRtToS3(bucketName, gtfsRtFeed);

        logger.info("GTFS-RT saved to S3 successfully");

        if (saveJson === "true") {
            const decodedJson = transit_realtime.FeedMessage.decode(gtfsRtFeed);

            await putS3Object({
                Bucket: bucketName,
                Key: "gtfs-rt.json",
                ContentType: "application/json",
                Body: JSON.stringify(decodedJson),
            });
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);
        }

        logger.error("There was an error running the GTFS-RT Generator");

        throw e;
    }
};

const uploadToDatabase = async (dbClient: KyselyDb, xml: string) => {
    const xmlParser = new XMLParser({
        numberParseOptions: {
            hex: false,
            leadingZeros: false,
        },
    });

    const parsedXml = xmlParser.parse(xml) as Record<string, unknown>;

    const parsedJson = siriSchemaTransformed.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the AVL data");
        logger.error(parsedJson.error.format());

        throw new Error("Error parsing data");
    }

    logger.info("Matching AVL to timetable data...");
    const enrichedAvl = await matchAvlToTimetables(dbClient, parsedJson.data);

    const chunkedAvl = chunkArray(enrichedAvl, 2000);

    logger.info("Writing AVL data to database...");

    await Promise.all([
        generateGtfs(enrichedAvl),
        ...chunkedAvl.map((chunk) =>
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

const unzipAndUploadToDatabase = async (dbClient: KyselyDb, avlResponse: AxiosResponse<Stream>) => {
    const zip = avlResponse.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        if (fileName === "siri.xml") {
            await uploadToDatabase(dbClient, (await entry.buffer()).toString());
        }

        entry.autodrain();
    }
};

void (async () => {
    console.time("avl-processor");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting BODS AVL processor");

        const avlResponse = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/avl/download/bulk_archive", {
            responseType: "stream",
        });

        if (!avlResponse) {
            throw new Error("No AVL data found");
        }

        await unzipAndUploadToDatabase(dbClient, avlResponse);

        logger.info("BODS AVL processor successful");
        console.timeEnd("avl-processor");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);
        }

        logger.error("There was a problem with the AVL retriever");

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
