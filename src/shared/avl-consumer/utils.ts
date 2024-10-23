import { z } from "zod";
import { getDynamoItem, recursiveQuery, recursiveScan } from "../dynamo";
import { AvlConsumerSubscription, avlConsumerSubscriptionSchema, avlConsumerSubscriptionsSchema } from "../schema";
import { SubscriptionIdNotFoundError } from "../utils";
import { createStringLengthValidation } from "../validation";

export const subscriptionTriggerMessageSchema = z.object({
    subscriptionPK: z.string(),
    SK: z.string(),
    frequencyInSeconds: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
    queueUrl: z.string().url(),
});

export type AvlSubscriptionTriggerMessage = z.infer<typeof subscriptionTriggerMessageSchema>;

export const subscriptionDataSenderMessageSchema = z
    .string()
    .transform((body) => JSON.parse(body))
    .pipe(
        z.object({
            subscriptionPK: createStringLengthValidation("subscriptionPK"),
            SK: createStringLengthValidation("SK"),
            messageType: z.enum(["data", "heartbeat"]),
        }),
    );

export type AvlSubscriptionDataSenderMessage = z.infer<typeof subscriptionDataSenderMessageSchema>;

export const getAvlConsumerSubscriptionByPK = async (tableName: string, PK: string, SK: string) => {
    const subscription = await getDynamoItem<AvlConsumerSubscription>(tableName, { PK, SK });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription PK: ${PK} not found in DynamoDB`);
    }

    return avlConsumerSubscriptionSchema.parse(subscription);
};

export const getAvlConsumerSubscription = async (tableName: string, apiKey: string, subscriptionId: string) => {
    const subscriptions = await recursiveQuery<AvlConsumerSubscription>({
        TableName: tableName,
        IndexName: "subscriptionId-index",
        KeyConditionExpression: "subscriptionId = :subscriptionId AND SK = :SK",
        ExpressionAttributeValues: {
            ":subscriptionId": subscriptionId,
            ":SK": apiKey,
        },
    });

    if (subscriptions.length === 0) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return avlConsumerSubscriptionSchema.parse(subscriptions[0]);
};

export const getAvlConsumerSubscriptions = async (tableName: string, apiKey: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
        FilterExpression: "SK = :SK",
        ExpressionAttributeValues: {
            ":SK": apiKey,
        },
    });

    if (!subscriptions) {
        return [];
    }

    return avlConsumerSubscriptionsSchema.parse(subscriptions);
};
