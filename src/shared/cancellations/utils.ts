import { KyselyDb, NewSituation } from "../database";
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

export const insertSituations = async (dbClient: KyselyDb, cancellations: NewSituation[]) => {
    const insertChunks = chunkArray(cancellations, 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto("situation")
                .values(chunk)
                .onConflict((oc) =>
                    oc.columns(["situation_number", "version"]).doUpdateSet((eb) => ({
                        response_time_stamp: eb.ref("excluded.response_time_stamp"),
                        producer_ref: eb.ref("excluded.producer_ref"),
                        situation: eb.ref("excluded.situation"),
                    })),
                )
                .execute(),
        ),
    );
};
