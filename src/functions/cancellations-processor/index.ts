import { getCancellationsSubscription, insertCancellations } from "@bods-integrated-data/shared/cancellations/utils";
import { KyselyDb, NewSituation, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { siriSxSchema } from "@bods-integrated-data/shared/schema";
import { S3Event, S3EventRecord, SQSHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";

let dbClient: KyselyDb;

const arrayProperties = ["VehicleActivity", "OnwardCall"];

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
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
                `Unable to process cancellations for subscription ${subscriptionId} because it is inactive.`,
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
                const situations = siriSx?.Siri.ServiceDelivery.SituationExchangeDelivery.Situations.PtSituationElement;

                const cancellations: NewSituation[] = situations.flatMap((situation) => {
                    return situation.Consequences.Consequence.map((_consequence) => {
                        const cancellation: NewSituation = {};
                        // todo: map data

                        return cancellation;
                    });
                });

                await insertCancellations(dbClient, cancellations, subscriptionId);
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
        logger.info(`Starting processing of SIRI-VM. Number of records to process: ${event.Records.length}`);

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
