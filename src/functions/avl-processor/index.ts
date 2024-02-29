import { logger } from "@baselime/lambda-logger";
import { Database, chunkArray, getDatabaseClient, getS3Object } from "@bods-integrated-data/shared";
import { S3Event, S3EventRecord, SQSEvent } from "aws-lambda";
import { Kysely } from "kysely";
import { parseStringPromise } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors.js";
import { VehicleActivity, siriSchema } from "./schema/siri.schema";

const saveSiriToDatabase = async (vehicleActivity: VehicleActivity, dbClient: Kysely<Database>) => {
    const insertChunks = chunkArray(vehicleActivity, 3000);

    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("avl").values(chunk).execute()));
};

const makeVehicleActivityArray = (value: string, name: string) => {
    if (name === "VehicleActivity") {
        if (!Array.isArray(value)) {
            return [value];
        }
    }

    return value;
};

const parseXml = async (xml: string) => {
    const parsedXml = (await parseStringPromise(xml, {
        explicitArray: false,
        valueProcessors: [parseBooleans, makeVehicleActivityArray],
        ignoreAttrs: true,
    })) as Record<string, object>;

    const parsedJson = siriSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the AVL data", parsedJson.error.format());

        throw new Error("Error parsing data");
    }

    return parsedJson.data;
};

export const processSqsRecord = async (record: S3EventRecord, dbClient: Kysely<Database>) => {
    const data = await getS3Object({
        Bucket: record.s3.bucket.name,
        Key: decodeURIComponent(record.s3.object.key.replace(/\+/g, " ")),
    });

    const body = data.Body;

    if (body) {
        const parsedSiri = await parseXml(await body.transformToString());
        await saveSiriToDatabase(parsedSiri, dbClient);
    }
};

export const handler = async (event: SQSEvent) => {
    try {
        const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

        logger.info(`Starting processing of SIRI-VM. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) =>
                Promise.all(
                    (JSON.parse(record.body) as S3Event).Records.map((s3Record) =>
                        processSqsRecord(s3Record, dbClient),
                    ),
                ),
            ),
        );

        logger.info("AVL uploaded to database successfully");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("AVL Processor has failed", e);

            throw e;
        }

        throw e;
    }
};
