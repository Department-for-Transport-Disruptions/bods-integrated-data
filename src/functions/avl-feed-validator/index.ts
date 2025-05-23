import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscribeMessage, AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/unsubscribe";
import {
    checkSubscriptionIsHealthy,
    getSubscriptionUsernameAndPassword,
    isPrivateAddress,
} from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const resubscribeToDataProducer = async (
    subscription: AvlSubscription,
    subscribeEndpoint: string,
    avlProducerApiKeyArn: string,
) => {
    logger.info(`Attempting to resubscribe to subscription ID: ${subscription.PK}`);

    const { subscriptionUsername, subscriptionPassword } = await getSubscriptionUsernameAndPassword(
        subscription.PK,
        "avl",
    );

    if (!subscriptionUsername || !subscriptionPassword) {
        throw new Error(
            `Cannot resubscribe to data producer as username or password is missing for subscription ID: ${subscription.PK}`,
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
        logger.info("Starting AVL feed validator");

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
                const subscriptionIsHealthy = checkSubscriptionIsHealthy(
                    currentTime,
                    subscription,
                    subscription.lastAvlDataReceivedDateTime,
                );

                if (subscriptionIsHealthy) {
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
                        "avl",
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
                            e.toJSON(),
                            `There was an error when resubscribing to the data producer - subscriptionId: ${subscription.PK}`,
                        );
                    } else {
                        logger.error(e, "There was an error when resubscribing to the data producer");
                    }

                    await putMetricData("custom/AVLMetrics", [
                        {
                            MetricName: "AvlFeedOutage",
                            Value: 1,
                        },
                    ]);

                    return;
                }

                logger.info(`Successfully resubscribed to data producer with subscription ID: ${subscription.PK}`);
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error when running the AVL feed validator");
        }

        throw e;
    }
};
