import { randomUUID } from "node:crypto";
import {
    getAvlConsumerSubscriptionByPK,
    subscriptionDataSenderMessageSchema,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { createSiriVm, createVehicleActivities, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { SQSHandler, SQSRecord } from "aws-lambda";
import axios, { AxiosError } from "axios";

let dbClient: KyselyDb;

const processSqsRecord = async (record: SQSRecord, dbClient: KyselyDb, consumerSubscriptionTableName: string) => {
    try {
        const { subscriptionPK, SK } = subscriptionDataSenderMessageSchema.parse(record.body);

        const subscription = await getAvlConsumerSubscriptionByPK(consumerSubscriptionTableName, subscriptionPK, SK);

        if (subscription.status !== "live") {
            throw new Error(`Subscription PK: ${subscriptionPK} no longer live`);
        }

        const { queryParams } = subscription;

        const avls = await getAvlDataForSiriVm(
            dbClient,
            queryParams.boundingBox,
            queryParams.operatorRef,
            queryParams.vehicleRef,
            queryParams.lineRef,
            queryParams.producerRef,
            queryParams.originRef,
            queryParams.destinationRef,
            queryParams.subscriptionId,
            subscription.lastRetrievedAvlId,
        );

        if (!avls.length) {
            return;
        }

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