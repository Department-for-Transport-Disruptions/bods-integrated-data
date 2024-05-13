import { logger } from "@baselime/lambda-logger";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { VehicleActivity, siriSchemaTransformed } from "@bods-integrated-data/shared/schema/siri.schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { S3Event, S3EventRecord, SQSEvent } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";

const saveSiriToDatabase = async (vehicleActivity: VehicleActivity, dbClient: KyselyDb) => {
    const insertChunks = chunkArray(vehicleActivity, 3000);

    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("avl").values(chunk).execute()));
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => tagName === "VehicleActivity",
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = siriSchemaTransformed.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the AVL data", parsedJson.error.format());

        throw new Error("Error parsing data");
    }

    return parsedJson.data;
};

export const processSqsRecord = async (record: S3EventRecord, dbClient: KyselyDb) => {
    const data = await getS3Object({
        Bucket: record.s3.bucket.name,
        Key: record.s3.object.key,
    });

    const body = data.Body;

    if (body) {
        const parsedSiri = parseXml(await body.transformToString());

        if (!parsedSiri || parsedSiri.length === 0) {
            throw new Error("Error parsing data");
        }

        await saveSiriToDatabase(parsedSiri, dbClient);
    }
};

export const handler = async (event: SQSEvent) => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
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
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
