import { randomUUID } from "node:crypto";
import {
    getAvlSubscription,
    getErrorDetails,
    insertAvls,
    insertAvlsWithOnwardCalls,
} from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { siriSchema, siriSchemaTransformed } from "@bods-integrated-data/shared/schema";
import { AvlValidationError } from "@bods-integrated-data/shared/schema/avl-validation-error.schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { S3Event, S3EventRecord, SQSEvent } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";

const arrayProperties = ["VehicleActivity", "OnwardCall"];

const parseXml = (xml: string, errors: AvlValidationError[]) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;
    const partiallyParsedSiri = siriSchema().deepPartial().parse(parsedXml.Siri);
    const parsedJson = siriSchemaTransformed(errors).safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the AVL data", parsedJson.error.format());
        errors.push(
            ...parsedJson.error.errors.map<AvlValidationError>((error) => {
                const { name, message, level } = getErrorDetails(error);

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
        responseTimestamp: partiallyParsedSiri.ServiceDelivery?.ResponseTimestamp,
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
    tableName: string,
    avlValidationErrorTableName: string,
) => {
    const subscriptionId = record.s3.object.key.substring(0, record.s3.object.key.indexOf("/"));

    const subscription = await getAvlSubscription(subscriptionId, tableName);

    if (subscription.status !== "LIVE") {
        throw new Error(`Unable to process AVL for subscription ${subscriptionId} with status ${subscription.status}`);
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

            throw new InvalidXmlError();
        }

        const avlsWithOnwardCalls = avls.filter((avl) => avl.onward_calls);
        const avlsWithoutOnwardCalls = avls
            .filter((avl) => !avl.onward_calls)
            .map<NewAvl>(({ onward_calls, ...rest }) => rest);

        if (avlsWithoutOnwardCalls.length > 0) {
            await insertAvls(dbClient, avlsWithoutOnwardCalls, subscriptionId);
        }

        if (avlsWithOnwardCalls.length > 0) {
            await insertAvlsWithOnwardCalls(dbClient, avlsWithOnwardCalls, subscriptionId);
        }

        await putMetricData(
            "custom/CAVLMetrics",
            [
                {
                    MetricName: "TotalAvlProcessed",
                    Value: avls.length,
                },
                {
                    MetricName: "TotalFilesProcessed",
                    Value: 1,
                },
            ],
            [
                {
                    Name: "SubscriptionId",
                    Value: subscriptionId,
                },
            ],
        );
    }
};

export const handler = async (event: SQSEvent) => {
    const { TABLE_NAME: tableName, AVL_VALIDATION_ERROR_TABLE_NAME: avlValidationErrorTableName } = process.env;

    if (!tableName || !avlValidationErrorTableName) {
        throw new Error("Missing env vars: TABLE_NAME and AVL_VALIDATION_ERROR_TABLE_NAME must be set.");
    }

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info(`Starting processing of SIRI-VM. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) =>
                Promise.all(
                    (JSON.parse(record.body) as S3Event).Records.map((s3Record) =>
                        processSqsRecord(s3Record, dbClient, tableName, avlValidationErrorTableName),
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
