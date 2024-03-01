import { logger } from "@baselime/lambda-logger";
import { Database, NaptanStop, getDatabaseClient, getS3Object } from "@bods-integrated-data/shared";
import { S3Event } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import { sql, Kysely } from "kysely";
import OsPoint from "ospoint";
import { parse } from "papaparse";

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

    const { data } = parse(body, {
        skipEmptyLines: "greedy",
        header: true,
        transformHeader: (header) => {
            const headerMap: { [key: string]: string } = {
                ATCOCode: "atcoCode",
            };

            return headerMap[header] ?? header.charAt(0).toLowerCase() + header.slice(1);
        },
    });

    return data;
};

const insertNaptanData = async (dbClient: Kysely<Database>, naptanData: unknown[]) => {
    const numRows = naptanData.length;
    const batches = [];

    while (naptanData.length > 0) {
        const chunk = naptanData.splice(0, 1000);
        batches.push(chunk);
    }

    logger.info(`Uploading ${numRows} rows to the database in ${batches.length} batches`);

    await dbClient.schema.dropTable("naptan_stop_new").ifExists().execute();

    await sql`create table naptan_stop_new as (select * from naptan_stop) with no data;`.execute(dbClient);

    await BluebirdPromise.map(
        batches,
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

export const handler = async (event: S3Event) => {
    try {
        const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

        logger.info(`Starting naptan uploader`);

        const naptanData = await getAndParseNaptanFile(event);
        const naptanDataWithLonsAndLats = addLonAndLatData(naptanData);

        await insertNaptanData(dbClient, naptanDataWithLonsAndLats);

        logger.info("Naptan uploader successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the naptan uploader", e);
        }

        throw e;
    }
};
