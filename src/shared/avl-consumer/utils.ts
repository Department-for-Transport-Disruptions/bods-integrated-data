import { SubscriptionIdNotFoundError } from "../avl/utils";
import { getDynamoItem } from "../dynamo";
import { AvlConsumerSubscription, avlConsumerSubscriptionSchema } from "../schema";

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
