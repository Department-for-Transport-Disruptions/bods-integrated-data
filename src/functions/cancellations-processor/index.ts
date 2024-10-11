import { getCancellationsSubscription, insertSituations } from "@bods-integrated-data/shared/cancellations/utils";
import { siriSxArrayProperties } from "@bods-integrated-data/shared/constants";
import { KyselyDb, NewSituation, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { siriSxSchema } from "@bods-integrated-data/shared/schema";
import { S3Event, S3EventRecord, SQSHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => siriSxArrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml);
    const parsedJson = siriSxSchema.safeParse(parsedXml);

    if (!parsedJson.success) {
        logger.error(`There was an error parsing the cancellations data: ${parsedJson.error.format()}`);
    }

    return parsedJson.data;
};

export const processSqsRecord = async (
    record: S3EventRecord,
    dbClient: KyselyDb,
    cancellationsSubscriptionTableName: string,
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
            const siriSx = parseXml(xml);

            if (siriSx) {
                const { ResponseTimestamp, ProducerRef, SituationExchangeDelivery } = siriSx.Siri.ServiceDelivery;
                const ptSituations = SituationExchangeDelivery.Situations.PtSituationElement;

                if (ptSituations) {
                    const situations: NewSituation[] = ptSituations.map((ptSituation) => {
                        const id = [subscriptionId, ptSituation.SituationNumber, ptSituation.Version].join("-");

                        const situation: NewSituation = {
                            id,
                            subscription_id: subscriptionId,
                            response_time_stamp: ResponseTimestamp,
                            producer_ref: ProducerRef,
                            situation_number: ptSituation.SituationNumber,
                            version: ptSituation.Version,
                            situation: ptSituation,
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

    const { CANCELLATIONS_SUBSCRIPTION_TABLE_NAME: cancellationsSubscriptionTableName } = process.env;

    if (!cancellationsSubscriptionTableName) {
        throw new Error("Missing env vars: CANCELLATIONS_SUBSCRIPTION_TABLE_NAME must be set.");
    }

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        logger.info(`Starting processing of SIRI-SX. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) =>
                Promise.all(
                    (JSON.parse(record.body) as S3Event).Records.map((s3Record) =>
                        processSqsRecord(s3Record, dbClient, cancellationsSubscriptionTableName),
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
