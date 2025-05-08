import { getCancellationsSubscriptions } from "@bods-integrated-data/shared/cancellations/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import {
    CancellationsSubscribeMessage,
    CancellationsSubscription,
} from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/unsubscribe";
import { checkSubscriptionIsHealthy, getSubscriptionUsernameAndPassword } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const resubscribeToDataProducer = async (
    subscription: CancellationsSubscription,
    subscribeEndpoint: string,
    cancellationsProducerApiKeyArn: string,
) => {
    logger.info(`Attempting to resubscribe to subscription ID: ${subscription.PK}`);

    const { subscriptionUsername, subscriptionPassword } = await getSubscriptionUsernameAndPassword(
        subscription.PK,
        "cancellations",
    );

    if (!subscriptionUsername || !subscriptionPassword) {
        throw new Error(
            `Cannot resubscribe to data producer as username or password is missing for subscription ID: ${subscription.PK}`,
        );
    }

    const subscriptionBody: CancellationsSubscribeMessage = {
        dataProducerEndpoint: subscription.url,
        description: subscription.description,
        shortDescription: subscription.shortDescription,
        username: subscriptionUsername,
        password: subscriptionPassword,
        requestorRef: subscription.requestorRef ?? null,
        subscriptionId: subscription.PK,
        publisherId: subscription.publisherId,
        operatorRef: subscription.operatorRef ?? null,
    };

    const cancellationsProducerApiKey = await getSecret<string>({ SecretId: cancellationsProducerApiKeyArn });

    await axios.post(subscribeEndpoint, subscriptionBody, { headers: { "x-api-key": cancellationsProducerApiKey } });
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        logger.info("Starting cancellations feed validator");

        const currentTime = getDate();

        const {
            TABLE_NAME: tableName,
            SUBSCRIBE_ENDPOINT: subscribeEndpoint,
            CANCELLATIONS_PRODUCER_API_KEY_ARN: cancellationsProducerApiKeyArn,
        } = process.env;

        if (!tableName || !subscribeEndpoint || !cancellationsProducerApiKeyArn) {
            throw new Error(
                "Missing env vars: TABLE_NAME, SUBSCRIBE_ENDPOINT and CANCELLATIONS_PRODUCER_API_KEY_ARN must be set",
            );
        }

        const subscriptions = await getCancellationsSubscriptions(tableName);
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
                    subscription.lastCancellationsDataReceivedDateTime,
                );

                if (subscriptionIsHealthy) {
                    if (subscription.status !== "live") {
                        await putDynamoItem<CancellationsSubscription>(tableName, subscription.PK, "SUBSCRIPTION", {
                            ...subscription,
                            status: "live",
                        });
                    }

                    return;
                }

                await putDynamoItem<CancellationsSubscription>(tableName, subscription.PK, "SUBSCRIPTION", {
                    ...subscription,
                    status: "error",
                });

                try {
                    await sendTerminateSubscriptionRequest("cancellations", subscription.PK, subscription, false);
                } catch (e) {
                    logger.warn(
                        `An error occurred when trying to unsubscribe from subscription with ID: ${subscription.PK}. Error ${e}`,
                    );
                }

                try {
                    await resubscribeToDataProducer(subscription, subscribeEndpoint, cancellationsProducerApiKeyArn);

                    await putMetricData("custom/CancellationsMetrics", [
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

                    await putMetricData("custom/CancellationsMetrics", [
                        {
                            MetricName: "CancellationsFeedOutage",
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
            logger.error(e, "There was an error when running the cancellations feed validator");
        }

        throw e;
    }
};
