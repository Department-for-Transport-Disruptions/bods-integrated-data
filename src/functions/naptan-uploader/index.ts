import { KyselyDb, NaptanStop, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { S3Event, S3Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import OsPoint from "ospoint";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { naptanSchemaTransformed } from "@bods-integrated-data/shared/schema/naptan.schema";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const arrayProperties = ["StopPoint", "StopAreas"];

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml);
    const parsedJson = naptanSchemaTransformed.safeParse(parsedXml);

    if (!parsedJson.success) {
        throw new Error("Unable to parse Naptan XML");
    }

    return parsedJson.data;
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

const getAndParseNaptanFile = async (event: S3Event) => {
    const { object, bucket } = event.Records[0].s3;

    const file = await getS3Object({
        Bucket: bucket.name,
        Key: object.key,
    });

    const body = (await file.Body?.transformToString()) || "";

    const data = parseXml(body);

    return data;
};

const insertNaptanData = async (
    dbClient: KyselyDb,
    naptanData: unknown[],
    tableName: "naptan_stop_new" | "naptan_stop_area_new",
    type: string,
) => {
    const numRows = naptanData.length;
    const batches = [];

    while (naptanData.length > 0) {
        const chunk = naptanData.splice(0, 1000);
        batches.push(chunk);
    }

    logger.info(`Uploading ${numRows} rows to the database in ${batches.length} batches`);

    await BluebirdPromise.map(
        batches,
        (batch) => {
            return dbClient
                .insertInto(tableName)
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
        logger.info("Starting naptan uploader");

        const { stopPoints, stopAreas } = await getAndParseNaptanFile(event);
        const naptanStopsWithLonsAndLats = addLonAndLatData(stopPoints);
        const naptanStopsWithLonsAndLatsWithStopAreas = addLonAndLatData(stopAreas);

        await insertNaptanData(dbClient, naptanStopsWithLonsAndLats);

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
