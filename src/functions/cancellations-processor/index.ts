import { randomUUID } from "node:crypto";
import {
    getCancellationErrorDetails,
    getCancellationsSubscription,
    insertSituations,
} from "@bods-integrated-data/shared/cancellations/utils";
import { siriSxArrayProperties } from "@bods-integrated-data/shared/constants";
import { KyselyDb, NewSituation, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { CancellationsValidationError, Period, siriSxSchema } from "@bods-integrated-data/shared/schema";
import { S3Event, S3EventRecord, SQSHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const parseXml = (xml: string, errors: CancellationsValidationError[]) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => siriSxArrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml);
    const parsedJson = siriSxSchema(errors).safeParse(parsedXml);

    if (!parsedJson.success) {
        logger.error(`There was an error parsing the cancellations data: ${parsedJson.error.format()}`);

        errors.push(
            ...parsedJson.error.errors.map<CancellationsValidationError>((error) => {
                const { name, message } = getCancellationErrorDetails(error);

                return {
                    PK: "",
                    SK: randomUUID(),
                    timeToExist: 0,
                    details: message,
                    filename: "",
                    name,
                    responseTimestamp: parsedXml?.Siri?.ServiceDelivery?.ResponseTimestamp,
                    responseMessageIdentifier: parsedXml?.Siri?.ServiceDelivery?.ResponseMessageIdentifier,
                    producerRef: parsedXml?.Siri?.ServiceDelivery?.ProducerRef,
                };
            }),
        );
    }

    return {
        responseTimestamp: parsedXml?.Siri?.ServiceDelivery?.ResponseTimestamp,
        siriSx: parsedJson.data,
    };
};

const uploadValidationErrorsToDatabase = async (
    subscriptionId: string,
    filename: string,
    tableName: string,
    errors: CancellationsValidationError[],
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

export const getSituationEndTime = (situationValidityPeriods: Period[]): string => {
    let situationEndTime = getDate();
    let hasEndTime = false;

    for (const validityPeriod of situationValidityPeriods) {
        const endTime = validityPeriod.EndTime ? getDate(validityPeriod.EndTime) : undefined;

        if (!!endTime && endTime >= situationEndTime) {
            situationEndTime = endTime;
            hasEndTime = true;
        }

        if (!hasEndTime) {
            // End time is an optional field in the SIRI-SC spec - if it is not provided we set a default end time of 24 hours after the current time.
            situationEndTime = situationEndTime.add(24, "hours");
        }
    }

    return situationEndTime.toISOString();
};

export const processSqsRecord = async (
    record: S3EventRecord,
    dbClient: KyselyDb,
    cancellationsSubscriptionTableName: string,
    cancellationsValidationErrorTableName: string,
) => {
    try {
        const subscriptionId = record.s3.object.key.substring(0, record.s3.object.key.indexOf("/"));
        logger.subscriptionId = subscriptionId;

        const subscription = await getCancellationsSubscription(subscriptionId, cancellationsSubscriptionTableName);

        if (subscription.status === "inactive") {
            logger.warn(`Subscription ${subscriptionId} is inactive, data will not be processed.`, {
                subscriptionId,
            });
            throw new Error(
                `Unable to process cancellations for subscription ${subscriptionId} because it is inactive`,
            );
        }

        const data = await getS3Object({
            Bucket: record.s3.bucket.name,
            Key: record.s3.object.key,
        });

        const body = data.Body;

        if (body) {
            const xml = await body.transformToString();
            const errors: CancellationsValidationError[] = [];
            const { responseTimestamp, siriSx } = parseXml(xml, errors);

            if (errors.length > 0) {
                await uploadValidationErrorsToDatabase(
                    subscriptionId,
                    record.s3.object.key,
                    cancellationsValidationErrorTableName,
                    errors,
                    responseTimestamp,
                );
            }

            if (siriSx) {
                const { ResponseTimestamp, ProducerRef, SituationExchangeDelivery } = siriSx.Siri.ServiceDelivery;
                const ptSituations = SituationExchangeDelivery.Situations.PtSituationElement;

                if (ptSituations) {
                    const situations: NewSituation[] = ptSituations.map((ptSituation) => {
                        const id = [subscriptionId, ptSituation.SituationNumber, ptSituation.Version].join("-");

                        const situationEndTime = getSituationEndTime(ptSituation.ValidityPeriod);

                        const situation: NewSituation = {
                            id,
                            subscription_id: subscriptionId,
                            response_time_stamp: ResponseTimestamp,
                            producer_ref: ProducerRef,
                            situation_number: ptSituation.SituationNumber,
                            version: ptSituation.Version,
                            situation: ptSituation,
                            end_time: situationEndTime,
                        };

                        return situation;
                    });

                    await insertSituations(dbClient, situations);
                }
            }

            logger.info("Cancellations processed successfully", {
                subscriptionId,
            });
        }
    } catch (e) {
        logger.error(`Cancellations processing failed for file ${record.s3.object.key}`);

        throw e;
    }
};

export const handler: SQSHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { CANCELLATIONS_SUBSCRIPTION_TABLE_NAME, CANCELLATIONS_ERRORS_TABLE_NAME } = process.env;

    if (!CANCELLATIONS_SUBSCRIPTION_TABLE_NAME || !CANCELLATIONS_ERRORS_TABLE_NAME) {
        throw new Error(
            "Missing env vars: CANCELLATIONS_SUBSCRIPTION_TABLE_NAME and CANCELLATIONS_ERRORS_TABLE_NAME must be set.",
        );
    }

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        logger.info(`Starting processing of SIRI-SX. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) =>
                Promise.all(
                    (JSON.parse(record.body) as S3Event).Records.map((s3Record) =>
                        processSqsRecord(
                            s3Record,
                            dbClient,
                            CANCELLATIONS_SUBSCRIPTION_TABLE_NAME,
                            CANCELLATIONS_ERRORS_TABLE_NAME,
                        ),
                    ),
                ),
            ),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Cancellations Processor has failed");
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
