import { getDynamoItem } from "../dynamo";
import { CancellationsSubscription, cancellationsSubscriptionSchema } from "../schema/cancellations-subscribe.schema";
import { SubscriptionIdNotFoundError } from "../utils";

export const getCancellationsSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<CancellationsSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return cancellationsSubscriptionSchema.parse(subscription);
};
