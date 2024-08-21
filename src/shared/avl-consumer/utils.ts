import { SubscriptionIdNotFoundError } from "../avl/utils";
import { getDynamoItem } from "../dynamo";
import { AvlConsumerSubscription, avlConsumerSubscriptionSchema } from "../schema";

export const getAvlConsumerSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<AvlConsumerSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return avlConsumerSubscriptionSchema.parse(subscription);
};
