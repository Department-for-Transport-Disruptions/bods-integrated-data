import { KyselyDb, NaptanStop, NaptanStopArea, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { naptanSchemaTransformed } from "@bods-integrated-data/shared/schema/naptan.schema";
import { S3Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import { XMLParser } from "fast-xml-parser";
import OsPoint from "ospoint";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const arrayProperties = ["StopPoint", "StopArea", "StopAreaRef"];

export const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml);
    return naptanSchemaTransformed.parse(parsedXml);
};

const addLonAndLatData = (naptanData: unknown[]) => {
    return (
        naptanData as {
            longitude: string;
            latitude: string;
            easting: string;
            northing: string;
        }[]
    ).map((item) => {
        if ((!item.longitude || !item.latitude) && item.easting && item.northing) {
            const osPoint = new OsPoint(item.northing, item.easting);

            const wgs84 = osPoint?.toWGS84();

            if (wgs84) {
                return {
                    ...item,
                    longitude: wgs84.longitude,
                    latitude: wgs84.latitude,
                };
            }
        }

        return {
            ...item,
        };
    });
};

const getAndParseNaptanFile = async (bucketName: string, filepath: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: filepath,
    });

    const body = (await file.Body?.transformToString()) || "";
    const data = parseXml(body);

    return data;
};

const insertNaptanData = async (dbClient: KyselyDb, naptanStops: unknown[], naptanStopAreas: unknown[]) => {
    const numStopAreaRows = naptanStopAreas.length;
    const stopAreaBatches = [];

    while (naptanStopAreas.length > 0) {
        const chunk = naptanStopAreas.splice(0, 1000);
        stopAreaBatches.push(chunk);
    }

    logger.info(
        `Uploading ${numStopAreaRows} rows to the naptan_stop_area_new table in ${stopAreaBatches.length} batches`,
    );

    await BluebirdPromise.map(
        stopAreaBatches,
        (batch) => {
            return dbClient
                .insertInto("naptan_stop_area_new")
                .values(batch as NaptanStopArea[])
                .onConflict((oc) => oc.doNothing())
                .execute()
                .then(() => 0);
        },
        {
            concurrency: 50,
        },
    );

    const numStopRows = naptanStops.length;
    const stopBatches = [];

    while (naptanStops.length > 0) {
        const chunk = naptanStops.splice(0, 1000);
        stopBatches.push(chunk);
    }

    logger.info(`Uploading ${numStopRows} rows to the naptan_stop_new table in ${stopBatches.length} batches`);

    await BluebirdPromise.map(
        stopBatches,
        (batch) => {
            return dbClient
                .insertInto("naptan_stop_new")
                .values(batch as NaptanStop[])
                .execute()
                .then(() => 0);
        },
        {
            concurrency: 50,
        },
    );
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        const bucketName = event.Records[0].s3.bucket.name;
        const filepath = event.Records[0].s3.object.key;
        logger.filepath = filepath;

        if (!filepath.endsWith(".xml")) {
            logger.info("Not an XML file, skipping");
            return;
        }

        logger.info("Starting naptan uploader");

        const { stopPoints, stopAreas } = await getAndParseNaptanFile(bucketName, filepath);
        const naptanStopsWithLonsAndLats = addLonAndLatData(stopPoints);
        const naptanStopAreasWithLonsAndLats = addLonAndLatData(stopAreas);

        await insertNaptanData(dbClient, naptanStopsWithLonsAndLats, naptanStopAreasWithLonsAndLats);

        logger.info("Naptan uploader successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the naptan uploader");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
