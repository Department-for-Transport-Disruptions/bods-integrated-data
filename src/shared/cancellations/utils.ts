import { KyselyDb, NewCancellation } from "../database";
import { getDynamoItem, recursiveScan } from "../dynamo";
import {
    CancellationsSubscription,
    cancellationsSubscriptionSchema,
    cancellationsSubscriptionsSchema,
} from "../schema/cancellations-subscribe.schema";
import { SubscriptionIdNotFoundError, chunkArray } from "../utils";

export const getCancellationsSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions) {
        return [];
    }

    return cancellationsSubscriptionsSchema.parse(subscriptions);
};

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

export const insertCancellations = async (
    dbClient: KyselyDb,
    cancellations: NewCancellation[],
    subscriptionId: string,
) => {
    const modifiedCancellations = cancellations.map((cancellation) => ({
        ...cancellation,
        subscription_id: subscriptionId,
    }));

    const insertChunks = chunkArray(modifiedCancellations, 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto("situation")
                .values(chunk)
                // todo: onConflict handler
                .execute(),
        ),
    );
};
