import { randomUUID } from "node:crypto";
import {
    getAvlConsumerSubscriptionByPK,
    subscriptionDataSenderMessageSchema,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { generateHeartbeatNotificationXml } from "@bods-integrated-data/shared/avl/heartbeat";
import { createSiriVm, createVehicleActivities, getAvlDataForSiriVm } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { SQSHandler, SQSRecord } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const MAX_HEARTBEAT_ATTEMPTS = 3;

let dbClient: KyselyDb;

const sendData = async (subscription: AvlConsumerSubscription, consumerSubscriptionTableName: string) => {
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

    try {
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
            logger.error(e.toJSON(), "Unsuccessful response from consumer subscription");
        }

        throw e;
    }
};

const sendHeartbeat = async (subscription: AvlConsumerSubscription, consumerSubscriptionTableName: string) => {
    const currentTime = getDate().toISOString();
    const heartbeatNotification = generateHeartbeatNotificationXml(subscription.subscriptionId, currentTime);

    try {
        await axios.post(subscription.url, heartbeatNotification, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        if (subscription.heartbeatAttempts > 0) {
            const updatedSubscription: AvlConsumerSubscription = {
                ...subscription,
                heartbeatAttempts: 0,
            };

            await putDynamoItem(consumerSubscriptionTableName, subscription.PK, subscription.SK, updatedSubscription);
        }
    } catch (e) {
        if (e instanceof AxiosError) {
            logger.warn(
                e.toJSON(),
                `Unsuccessful heartbeat notification response from subscription ${subscription.subscriptionId}`,
            );

            const updatedSubscription: AvlConsumerSubscription = {
                ...subscription,
                heartbeatAttempts: subscription.heartbeatAttempts + 1,
            };

            if (updatedSubscription.heartbeatAttempts >= MAX_HEARTBEAT_ATTEMPTS) {
                updatedSubscription.status = "error";
            }

            await putMetricData("custom/AvlConsumerMetrics", [
                {
                    MetricName: "SubscriptionUnreachable",
                    Value: 1,
                },
            ]);

            await putDynamoItem(consumerSubscriptionTableName, subscription.PK, subscription.SK, updatedSubscription);
        } else {
            logger.error(
                e,
                `Unhandled error sending heartbeat notification to subscription ${subscription.subscriptionId}`,
            );

            throw e;
        }
    }
};

const processSqsRecord = async (record: SQSRecord, consumerSubscriptionTableName: string) => {
    const { subscriptionPK, SK, messageType } = subscriptionDataSenderMessageSchema.parse(record.body);

    const subscription = await getAvlConsumerSubscriptionByPK(consumerSubscriptionTableName, subscriptionPK, SK);
    logger.subscriptionId = subscriptionPK;

    if (subscription.status !== "live") {
        logger.warn(`Subscription PK: ${subscriptionPK} no longer live`);
        return;
    }

    if (messageType === "data") {
        await sendData(subscription, consumerSubscriptionTableName);
    } else {
        await sendHeartbeat(subscription, consumerSubscriptionTableName);
    }
};

export const handler: SQSHandler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const { STAGE, AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME: avlConsumerSubscriptionTable } = process.env;

    if (!avlConsumerSubscriptionTable) {
        throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
    }

    dbClient = dbClient || (await getDatabaseClient(STAGE === "local"));

    try {
        logger.info(`Starting avl-consumer-data-sender. Number of records to process: ${event.Records.length}`);

        await Promise.all(event.Records.map((record) => processSqsRecord(record, avlConsumerSubscriptionTable)));
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
