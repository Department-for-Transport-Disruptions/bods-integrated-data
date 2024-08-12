import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { nocSchema } from "@bods-integrated-data/shared/schema/noc.schema";
import { S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { fromZodError } from "zod-validation-error";
import { insertNocOperator } from "./data/database";

const arrayProperties = ["NOCTableRecord"];

const getAndParseData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new Error("No xml data");
    }

    const parsedNoc = parser.parse(xml) as Record<string, unknown>;

    const nocJson = nocSchema.safeParse(parsedNoc);

    if (!nocJson.success) {
        const validationError = fromZodError(nocJson.error);
        logger.error(validationError.toString());

        throw validationError;
    }

    return nocJson.data;
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { bucket, object } = event.Records[0].s3;
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info(`Starting processing of NOC data for ${object.key}`);

        const nocData = await getAndParseData(bucket.name, object.key);

        const { travelinedata } = nocData;

        if (!travelinedata.NOCTable.NOCTableRecord || travelinedata.NOCTable.NOCTableRecord.length === 0) {
            logger.warn(`No NOCTableRecords found in file ${object.key}`);
            return;
        }

        await insertNocOperator(dbClient, travelinedata.NOCTable.NOCTableRecord);

        logger.info("NOC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the NOC processor, rolling back transaction", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
