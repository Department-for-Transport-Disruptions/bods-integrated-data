import { SubscriptionIdNotFoundError } from "../avl/utils";
import { queryDynamo, recursiveScan } from "../dynamo";
import { AvlConsumerSubscription, avlConsumerSubscriptionSchema, avlConsumerSubscriptionsSchema } from "../schema";

export const getAvlConsumerSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions) {
        return [];
    }

    return avlConsumerSubscriptionsSchema.parse(subscriptions);
};

export const getAvlConsumerSubscription = async (tableName: string, subscriptionId: string, userId: string) => {
    const subscriptions = await queryDynamo<AvlConsumerSubscription>({
        TableName: tableName,
        IndexName: "subscriptionId-index",
        KeyConditionExpression: "subscriptionId = :subscriptionId",
        ExpressionAttributeValues: {
            ":subscriptionId": subscriptionId,
        },
    });

    for (const subscription of subscriptions) {
        if (subscription.SK === userId) {
            return avlConsumerSubscriptionSchema.parse(subscription);
        }
    }

    throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
};

export const isActiveAvlConsumerSubscription = async (tableName: string, subscriptionId: string, userId: string) => {
    const subscriptions = await queryDynamo<AvlConsumerSubscription>({
        TableName: tableName,
        IndexName: "subscriptionId-index",
        KeyConditionExpression: "subscriptionId = :subscriptionId",
        ExpressionAttributeValues: {
            ":subscriptionId": subscriptionId,
        },
    });

    for (const subscription of subscriptions) {
        if (subscription.SK === userId && subscription.status === "live") {
            return true;
        }
    }

    return false;
};
