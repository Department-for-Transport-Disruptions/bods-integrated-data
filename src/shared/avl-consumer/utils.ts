import { SubscriptionIdNotFoundError } from "../avl/utils";
import { getDynamoItem, queryDynamo } from "../dynamo";
import {
    AvlConsumerSubscription,
    AvlSubscriptionStatus,
    avlConsumerSubscriptionSchema,
    avlConsumerSubscriptionsSchema,
} from "../schema";

export const getAvlConsumerSubscriptionsByStatus = async (tableName: string, status: AvlSubscriptionStatus) => {
    const subscriptions = await queryDynamo<AvlConsumerSubscription>({
        TableName: tableName,
        FilterExpression: "status = :status",
        ExpressionAttributeValues: {
            ":status": status,
        },
    });

    return avlConsumerSubscriptionsSchema.parse(subscriptions);
};

export const getAvlConsumerSubscriptionByPK = async (tableName: string, PK: string) => {
    const subscription = await getDynamoItem<AvlConsumerSubscription>(tableName, { PK });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription PK: ${PK} not found in DynamoDB`);
    }

    return avlConsumerSubscriptionSchema.parse(subscription);
};

export const getAvlConsumerSubscription = async (tableName: string, subscriptionId: string, userId: string) => {
    const subscriptions = await queryDynamo<AvlConsumerSubscription>({
        TableName: tableName,
        IndexName: "subscriptionId-index",
        KeyConditionExpression: "subscriptionId = :subscriptionId AND SK = :SK",
        ExpressionAttributeValues: {
            ":subscriptionId": subscriptionId,
            ":SK": userId,
        },
    });

    if (subscriptions.length === 0) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return avlConsumerSubscriptionSchema.parse(subscriptions[0]);
};
