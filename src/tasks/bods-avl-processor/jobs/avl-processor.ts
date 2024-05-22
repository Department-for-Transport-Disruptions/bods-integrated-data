/* eslint-disable no-console */
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { generateGtfsRtFeed, getAvlDataForGtfs, mapAvlToGtfsEntity } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { siriSchemaTransformed } from "@bods-integrated-data/shared/schema/avl.schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios, { AxiosResponse } from "axios";
import { XMLParser } from "fast-xml-parser";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import Pino from "pino";
import { Entry, Parse } from "unzipper";
import { Stream } from "stream";

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
            logger.error("There was a problem uploading GTFS-RT data to S3", error);
        }

        throw error;
    }
};

const generateGtfs = async () => {
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
        logger.error("There was an error parsing the AVL data", parsedJson.error.format());

        throw new Error("Error parsing data");
    }

    const avlWithGeom = parsedJson.data.map(
        (item): NewAvl => ({
            ...item,
            geom:
                item.longitude && item.latitude
                    ? sql`ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)`
                    : null,
        }),
    );

    const chunkedAvl = chunkArray(avlWithGeom, 2000);

    await Promise.all(chunkedAvl.map((chunk) => dbClient.insertInto("avl_bods").values(chunk).execute()));
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

    return [];
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

        await generateGtfs();
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL retriever", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
