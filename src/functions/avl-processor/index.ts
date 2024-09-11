import { randomUUID } from "node:crypto";
import { getAvlErrorDetails, getAvlSubscription, insertAvls } from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { siriSchema, siriSchemaTransformed } from "@bods-integrated-data/shared/schema";
import { AvlValidationError } from "@bods-integrated-data/shared/schema/avl-validation-error.schema";
import { S3Event, S3EventRecord, SQSHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";

let dbClient: KyselyDb;

const arrayProperties = ["VehicleActivity", "OnwardCall"];

const parseXml = (xml: string, errors: AvlValidationError[]) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;
    const partiallyParsedSiri = siriSchema().deepPartial().safeParse(parsedXml).data;
    const parsedJson = siriSchemaTransformed(errors).safeParse(parsedXml);

    if (!parsedJson.success) {
        logger.error(`There was an error parsing the AVL data: ${parsedJson.error.format()}`);
        errors.push(
            ...parsedJson.error.errors.map<AvlValidationError>((error) => {
                const { name, message, level } = getAvlErrorDetails(error);

                return {
                    PK: "",
                    SK: randomUUID(),
                    details: message,
                    filename: "",
                    level,
                    name,
                    timeToExist: 0,
                };
            }),
        );
    }

    return {
        responseTimestamp: partiallyParsedSiri?.Siri?.ServiceDelivery?.ResponseTimestamp,
        avls: parsedJson.success ? parsedJson.data : [],
    };
};

const uploadValidationErrorsToDatabase = async (
    subscriptionId: string,
    filename: string,
    tableName: string,
    errors: AvlValidationError[],
    responseTimestamp?: string,
) => {
    const timeToExist = getDate().add(3, "days").unix();

    for (const error of errors) {
        error.PK = subscriptionId;
        error.filename = filename;
        error.responseTimestamp = responseTimestamp;
        error.timeToExist = timeToExist;
    }

    await putDynamoItems(tableName, errors);
};

export const processSqsRecord = async (
    record: S3EventRecord,
    dbClient: KyselyDb,
    avlSubscriptionTableName: string,
    avlValidationErrorTableName: string,
) => {
    try {
        const subscriptionId = record.s3.object.key.substring(0, record.s3.object.key.indexOf("/"));

        logger.subscriptionId = subscriptionId;
        const subscription = await getAvlSubscription(subscriptionId, avlSubscriptionTableName);

        if (subscription.status === "inactive") {
            logger.warn(`Subscription ${subscriptionId} is inactive, data will not be processed.`, {
                subscriptionId,
            });
            throw new Error(`Unable to process AVL for subscription ${subscriptionId} because it is inactive.`);
        }

        const data = await getS3Object({
            Bucket: record.s3.bucket.name,
            Key: record.s3.object.key,
        });

        const body = data.Body;

        if (body) {
            const xml = await body.transformToString();
            const errors: AvlValidationError[] = [];
            const { responseTimestamp, avls } = parseXml(xml, errors);

            if (errors.length > 0) {
                await uploadValidationErrorsToDatabase(
                    subscriptionId,
                    record.s3.object.key,
                    avlValidationErrorTableName,
                    errors,
                    responseTimestamp,
                );
            }

            await insertAvls(dbClient, avls, subscriptionId);

            logger.info("AVL processed successfully", {
                subscriptionId,
            });
        }
    } catch (e) {
        logger.error(`AVL processing failed for file ${record.s3.object.key}`);

        throw e;
    }
};

export const handler: SQSHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const {
        AVL_SUBSCRIPTION_TABLE_NAME: avlSubscriptionTableName,
        AVL_VALIDATION_ERROR_TABLE_NAME: avlValidationErrorTableName,
    } = process.env;

    if (!avlSubscriptionTableName || !avlValidationErrorTableName) {
        throw new Error(
            "Missing env vars: AVL_SUBSCRIPTION_TABLE_NAME and AVL_VALIDATION_ERROR_TABLE_NAME must be set.",
        );
    }

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        logger.info(`Starting processing of SIRI-VM. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) =>
                Promise.all(
                    (JSON.parse(record.body) as S3Event).Records.map((s3Record) =>
                        processSqsRecord(s3Record, dbClient, avlSubscriptionTableName, avlValidationErrorTableName),
                    ),
                ),
            ),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "AVL Processor has failed");
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
