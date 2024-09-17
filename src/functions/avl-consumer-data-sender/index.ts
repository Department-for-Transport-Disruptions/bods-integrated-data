import { randomUUID } from "node:crypto";
import { getAvlConsumerSubscription } from "@bods-integrated-data/shared/avl-consumer/utils";
import { createSiriVm, createVehicleActivities, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { SQSHandler, SQSRecord } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { z } from "zod";

let dbClient: KyselyDb;

const eventMessageSchema = z
    .string()
    .transform((body) => JSON.parse(body))
    .pipe(
        z.object({
            subscriptionId: createStringLengthValidation("subscriptionId"),
            userId: createStringLengthValidation("userId"),
        }),
    );

const processSqsRecord = async (record: SQSRecord, dbClient: KyselyDb, consumerSubscriptionTableName: string) => {
    try {
        const { subscriptionId, userId } = eventMessageSchema.parse(record.body);
        logger.subscriptionId = subscriptionId;

        const subscription = await getAvlConsumerSubscription(consumerSubscriptionTableName, subscriptionId, userId);

        if (subscription.status !== "live") {
            throw new Error("Subscription no longer live");
        }

        const avls = await getAvlDataForSiriVm(
            dbClient,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            subscription.producerSubscriptionIds.split(","),
            subscription.lastRetrievedAvlId,
        );

        const requestMessageRef = randomUUID();
        const responseTime = getDate();
        const vehicleActivities = createVehicleActivities(avls, responseTime);

        const siriVm = createSiriVm(vehicleActivities, requestMessageRef, responseTime);

        await axios.post(subscription.url, siriVm, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        let highestRetrievedAvlId = 0;

        for (const avl of avls) {
            if (avl.id > highestRetrievedAvlId) {
                highestRetrievedAvlId = avl.id;
            }
        }

        const updatedSubscription: AvlConsumerSubscription = {
            ...subscription,
            lastRetrievedAvlId: highestRetrievedAvlId,
        };

        await putDynamoItem(consumerSubscriptionTableName, subscription.PK, subscription.SK, updatedSubscription);
    } catch (e) {
        if (e instanceof AxiosError) {
            logger.error(e, "Unsuccessful response from consumer subscription");
        }

        throw e;
    }
};

export const handler: SQSHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { STAGE, AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME } = process.env;

    if (!AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME) {
        throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
    }

    dbClient = dbClient || (await getDatabaseClient(STAGE === "local"));

    try {
        logger.info(`Starting avl-consumer-data-sender. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) => processSqsRecord(record, dbClient, AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME)),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-data-sender endpoint");
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
