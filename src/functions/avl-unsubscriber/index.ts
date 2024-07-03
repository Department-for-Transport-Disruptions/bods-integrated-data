import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { logger } from "@baselime/lambda-logger";
import { sendTerminateSubscriptionRequestAndUpdateDynamo } from "@bods-integrated-data/shared/avl/unsubscribe";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { deleteParameters } from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { AxiosError } from "axios";

const deleteSubscriptionAuthCredsFromSsm = async (subscriptionId: string) => {
    logger.info("Deleting subscription auth credentials from parameter store");

    await deleteParameters([`/subscription/${subscriptionId}/username`, `/subscription/${subscriptionId}/password`]);
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const { TABLE_NAME: tableName } = process.env;

        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME must be set.");
        }

        const subscriptionId = event.pathParameters?.subscriptionId;

        if (!subscriptionId) {
            throw new Error("Subscription ID must be provided in the path parameters");
        }

        logger.info(`Starting AVL unsubscriber to unsubscribe from subscription: ${subscriptionId}`);

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
            url: subscription.url,
            description: subscription.description,
            shortDescription: subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
            serviceStartDatetime: subscription.serviceStartDatetime,
            lastModifiedDateTime: subscription.lastModifiedDateTime,
        };
        try {
            await sendTerminateSubscriptionRequestAndUpdateDynamo(subscriptionId, subscriptionDetail, tableName);
        } catch (e) {
            await putMetricData(`custom/CAVLMetrics`, [
                {
                    MetricName: "failedUnsubscribeRequest",
                    Value: 1,
                   }
            ]);
            if (e instanceof AxiosError) {
                logger.error(
                    `There was an error when sending the unsubscribe request to the data producer for subscription ${subscriptionId} - code: ${e.code}, message: ${e.message}`,
                );
            }

            throw e;
        }

        await deleteSubscriptionAuthCredsFromSsm(subscriptionId);

        logger.info(`Successfully unsubscribed to data producer with subscription ID: ${subscriptionId}.`);

        return {
            statusCode: 204,
        };
    } catch (e) {
        await putMetricData(`custom/CAVLMetrics`, [
            {
                MetricName: "failedUnsubscribeRequest",
                Value: 1,
               }
        ]);
        if (e instanceof SubscriptionIdNotFoundError) {
            return {
                statusCode: 404,
                body: e.message,
            };
        }
        if (e instanceof Error) {
            logger.error("There was a problem unsubscribing from  the AVL feed.", e);

            throw e;
        }

        throw e;
    }
};
