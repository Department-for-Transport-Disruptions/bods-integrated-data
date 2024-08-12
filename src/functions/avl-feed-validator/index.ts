import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/avl/unsubscribe";
import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate, isDateAfter } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscribeMessage, AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { getSubscriptionUsernameAndPassword, isPrivateAddress } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios, { AxiosError } from "axios";

export const resubscribeToDataProducer = async (
    subscription: AvlSubscription,
    subscribeEndpoint: string,
    avlProducerApiKeyArn: string,
) => {
    logger.info(`Attempting to resubscribe to subscription ID: ${subscription.PK}`);

    const { subscriptionUsername, subscriptionPassword } = await getSubscriptionUsernameAndPassword(subscription.PK);

    if (!subscriptionUsername || !subscriptionPassword) {
        throw new Error(
            `Cannot resubscribe to data producer as username or password is missing for subscription ID: ${subscription.PK}.`,
        );
    }

    const subscriptionBody: AvlSubscribeMessage = {
        dataProducerEndpoint: subscription.url,
        description: subscription.description,
        shortDescription: subscription.shortDescription,
        username: subscriptionUsername,
        password: subscriptionPassword,
        requestorRef: subscription.requestorRef ?? null,
        subscriptionId: subscription.PK,
        publisherId: subscription.publisherId,
    };

    const avlProducerApiKey = await getSecret<string>({ SecretId: avlProducerApiKeyArn });

    await axios.post(subscribeEndpoint, subscriptionBody, { headers: { "x-api-key": avlProducerApiKey } });
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        logger.info("Starting AVL feed validator.");

        const currentTime = getDate();

        const {
            TABLE_NAME: tableName,
            SUBSCRIBE_ENDPOINT: subscribeEndpoint,
            AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn,
        } = process.env;

        if (!tableName || !subscribeEndpoint || !avlProducerApiKeyArn) {
            throw new Error(
                "Missing env vars: TABLE_NAME, SUBSCRIBE_ENDPOINT and AVL_PRODUCER_API_KEY_ARN must be set",
            );
        }

        const subscriptions = await getAvlSubscriptions(tableName);
        const nonTerminatedSubscriptions = subscriptions.filter((subscription) => subscription.status !== "inactive");

        if (!nonTerminatedSubscriptions) {
            logger.info("No subscriptions found in DynamoDb to validate");
            return;
        }

        await Promise.all(
            nonTerminatedSubscriptions.map(async (subscription) => {
                // We expect to receive a heartbeat notification from a data producer every 30 seconds.
                // If we do not receive a heartbeat notification after 90 seconds we will attempt to resubscribe to the data producer.
                const isHeartbeatValid = isDateAfter(
                    getDate(subscription.heartbeatLastReceivedDateTime ?? subscription.serviceStartDatetime),
                    currentTime.subtract(90, "seconds"),
                );

                if (isHeartbeatValid) {
                    if (subscription.status !== "live") {
                        await putDynamoItem<AvlSubscription>(tableName, subscription.PK, "SUBSCRIPTION", {
                            ...subscription,
                            status: "live",
                        });
                    }

                    return;
                }

                await putDynamoItem<AvlSubscription>(tableName, subscription.PK, "SUBSCRIPTION", {
                    ...subscription,
                    status: "error",
                });

                try {
                    await sendTerminateSubscriptionRequest(
                        subscription.PK,
                        subscription,
                        isPrivateAddress(subscription.url),
                    );
                } catch (e) {
                    logger.warn(
                        `An error occurred when trying to unsubscribe from subscription with ID: ${subscription.PK}. Error ${e}`,
                    );
                }

                try {
                    await resubscribeToDataProducer(subscription, subscribeEndpoint, avlProducerApiKeyArn);

                    await putMetricData("custom/AVLMetrics", [
                        {
                            MetricName: "Resubscriptions",
                            Value: 1,
                        },
                    ]);
                } catch (e) {
                    if (e instanceof AxiosError) {
                        logger.error(
                            `There was an error when resubscribing to the data producer - code: ${e.code}, message: ${e.message}`,
                        );
                    }

                    await putMetricData("custom/AVLMetrics", [
                        {
                            MetricName: "AvlFeedOutage",
                            Value: 1,
                        },
                    ]);

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
