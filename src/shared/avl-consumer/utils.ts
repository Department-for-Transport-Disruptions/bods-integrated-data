import { getDynamoItem } from "../dynamo";
import { AvlConsumerSubscription } from "../schema";

export const isActiveAvlConsumerSubscription = async (tableName: string, subscriptionId: string) => {
    const subscription = await getDynamoItem<AvlConsumerSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    return subscription?.status === "live";
};
