import { SubscriptionIdNotFoundError } from "../avl/utils";
import { getDynamoItem, recursiveScan } from "../dynamo";
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

export const getAvlConsumerSubscription = async (tableName: string, subscriptionId: string) => {
    const subscription = await getDynamoItem<AvlConsumerSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return avlConsumerSubscriptionSchema.parse(subscription);
};

export const isActiveAvlConsumerSubscription = async (tableName: string, subscriptionId: string) => {
    const subscription = await getDynamoItem<AvlConsumerSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    return subscription?.status === "live";
};
