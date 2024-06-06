import { logger } from "@baselime/lambda-logger";
import { getDate, isDateAfter, subtractIntervalFromDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem, recursiveScan } from "@bods-integrated-data/shared/dynamo";
import { AvlSubscription, avlSubscriptionsSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { getSubscriptionUsernameAndPassword } from "@bods-integrated-data/shared/utils";
import axios, { AxiosError } from "axios";

export const getSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions || subscriptions.length === 0) {
        return null;
    }

    const parsedSubscriptions = avlSubscriptionsSchema.parse(subscriptions);

    return parsedSubscriptions.filter((subscription) => subscription.status !== "TERMINATED");
};

export const resubscribeToDataProducer = async (subscription: AvlSubscription, subscribeEndpoint: string) => {
    logger.info(`Attempting to resubscribe to subscription ID: ${subscription.PK}`);

    const { subscriptionUsername, subscriptionPassword } = await getSubscriptionUsernameAndPassword(subscription.PK);

    if (!subscriptionUsername || !subscriptionPassword) {
        throw new Error(
            `Cannot resubscribe to data produce as username or password is missing for subscription ID: ${subscription.PK}.`,
        );
    }

    const subscriptionBody = {
        dataProducerEndpoint: subscription.url,
        description: subscription.description,
        shortDescription: subscription.shortDescription,
        username: subscriptionUsername,
        password: subscriptionPassword,
        requestorRef: subscription.requestorRef ?? null,
        subscriptionId: subscription.PK,
    };

    await axios.post(subscribeEndpoint, subscriptionBody);
};

export const handler = async () => {
    try {
        logger.info("Starting AVL feed validator.");

        const currentTime = getDate();

        const { STAGE: stage, TABLE_NAME: tableName, SUBSCRIBE_ENDPOINT: subscribeEndpoint } = process.env;

        if (!stage || !tableName || !subscribeEndpoint) {
            throw new Error("Missing env vars: STAGE, TABLE_NAME and SUBSCRIBE_ENDPOINT must be set");
        }

        const subscriptions = await getSubscriptions(tableName);

        if (!subscriptions) {
            logger.info("No subscriptions found in DynamoDb to validate");
            return;
        }

        await Promise.all(
            subscriptions.map(async (subscription) => {
                // We expect to receive a heartbeat notification from a data producer every 30 seconds.
                // If we do not receive a heartbeat notification after 90 seconds we will attempt to resubscribe to the data producer.
                const isHeartbeatValid = isDateAfter(
                    getDate(subscription.heartbeatLastReceivedDateTime ?? subscription.serviceStartDatetime),
                    subtractIntervalFromDate(currentTime, 90, "s"),
                );

                if (isHeartbeatValid) {
                    return;
                }

                await putDynamoItem<AvlSubscription>(tableName, subscription.PK, "SUBSCRIPTION", {
                    ...subscription,
                    status: "UNAVAILABLE",
                });

                try {
                    await resubscribeToDataProducer(subscription, subscribeEndpoint);
                } catch (e) {
                    if (e instanceof AxiosError) {
                        logger.error(
                            `There was an error when resubscribing to the data producer - code: ${e.code}, message: ${e.message}`,
                        );
                    }

                    throw e;
                }

                logger.info(`Successfully resubscribed to data producer with subscription ID: ${subscription.PK}`);
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error when running the AVL feed validator", e);
        }

        throw e;
    }
};
