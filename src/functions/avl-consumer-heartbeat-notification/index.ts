import {} from "@bods-integrated-data/shared/api";
import { getAvlConsumerSubscriptions } from "@bods-integrated-data/shared/avl-consumer/utils";
import { generateHeartbeatNotificationXml } from "@bods-integrated-data/shared/avl/heartbeat";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { Handler } from "aws-lambda";
import axios, { AxiosError } from "axios";

const MAX_HEARTBEAT_ATTEMPTS = 3;

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME: avlConsumerSubscriptionTableName } = process.env;

        if (!avlConsumerSubscriptionTableName) {
            throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
        }

        const liveSubscriptions = await getAvlConsumerSubscriptions(avlConsumerSubscriptionTableName, "live");
        const currentTimestamp = getDate().toISOString();

        await Promise.all(
            liveSubscriptions.map(async (subscription) => {
                const heartbeatNotification = generateHeartbeatNotificationXml(
                    subscription.subscriptionId,
                    currentTimestamp,
                );

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

                        await putDynamoItem(
                            avlConsumerSubscriptionTableName,
                            subscription.PK,
                            subscription.SK,
                            updatedSubscription,
                        );
                    }
                } catch (e) {
                    if (e instanceof AxiosError) {
                        logger.warn(
                            `Unsuccessful heartbeat notification response from subscription ${subscription.subscriptionId}, code: ${e.code}, message: ${e.message}`,
                        );

                        const updatedSubscription: AvlConsumerSubscription = {
                            ...subscription,
                            heartbeatAttempts: subscription.heartbeatAttempts + 1,
                        };

                        if (updatedSubscription.heartbeatAttempts >= MAX_HEARTBEAT_ATTEMPTS) {
                            updatedSubscription.status = "error";
                        }

                        await putDynamoItem(
                            avlConsumerSubscriptionTableName,
                            subscription.PK,
                            subscription.SK,
                            updatedSubscription,
                        );
                    } else {
                        logger.error(
                            `Unhandled error sending heartbeat notification to subscription ${subscription.subscriptionId}`,
                            e,
                        );
                    }
                }
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the avl-consumer-heartbeat-notification endpoint", e);
        }

        throw e;
    }
};
