import { DeleteAlarmsCommand } from "@aws-sdk/client-cloudwatch";
import { DeleteEventSourceMappingCommand } from "@aws-sdk/client-lambda";
import { DeleteScheduleCommand } from "@aws-sdk/client-scheduler";
import { GetSecretValueCommand, ListSecretsCommand } from "@aws-sdk/client-secrets-manager";
import { DeleteQueueCommand } from "@aws-sdk/client-sqs";
import { DeleteCommand, GetCommand, NativeAttributeValue, PutCommand } from "@aws-sdk/lib-dynamodb";
import { AvlConsumerSubscription, AvlSubscription } from "@bods-integrated-data/shared/schema";
import {
    createCloudWatchClient,
    createDynamoDbDocClient,
    createLambdaClient,
    createSchedulerClient,
    createSecretsManagerClient,
    createSqsClient,
} from "./awsClients";

const dynamoDbClient = createDynamoDbDocClient();

export const getSecretByKey = async <T extends string>(key: string): Promise<T> => {
    const secretsManagerClient = createSecretsManagerClient();

    const listSecretsCommand = new ListSecretsCommand({
        Filters: [
            {
                Key: "name",
                Values: [key],
            },
        ],
    });

    const listSecretsResponse = await secretsManagerClient.send(listSecretsCommand);
    const secretsList = listSecretsResponse.SecretList;

    if (!secretsList) {
        throw new Error("Secrets list could not be retrieved");
    }

    if (secretsList.length === 0 || !secretsList[0].ARN) {
        throw new Error(`Secret with key does not exist: ${key}`);
    }

    const secretId = secretsList[0].ARN;

    const getSecretCommand = new GetSecretValueCommand({
        SecretId: secretId,
    });

    const response = await secretsManagerClient.send(getSecretCommand);
    const secret = response.SecretString;

    secretsManagerClient.destroy();

    if (!secret) {
        throw new Error(`Secret could not be retrieved: ${secretId}`);
    }

    return JSON.parse(secret) as T;
};

export const deleteDynamoItem = async (tableName: string, key: Record<string, NativeAttributeValue>) => {
    await dynamoDbClient.send(
        new DeleteCommand({
            TableName: tableName,
            Key: key,
        }),
    );
};

export const getDynamoItem = async <T extends Record<string, unknown>>(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
) => {
    const data = await dynamoDbClient.send(
        new GetCommand({
            TableName: tableName,
            Key: key,
        }),
    );

    return data.Item ? (data.Item as T) : null;
};

export const putDynamoItem = async <T extends Record<string, unknown>>(
    tableName: string,
    pk: string,
    sk: string,
    tableItems: T,
) => {
    await dynamoDbClient.send(
        new PutCommand({
            TableName: tableName,
            Item: {
                PK: pk,
                SK: sk,
                ...tableItems,
            },
        }),
    );
};

export const createAvlProducerSubscription = async (subscriptionTableName: string, subscription: AvlSubscription) => {
    await putDynamoItem(subscriptionTableName, subscription.PK, "SUBSCRIPTION", subscription);
};

export const getAvlProducerSubscription = async (subscriptionTableName: string, subscriptionId: string) => {
    const dynamoItem = await getDynamoItem(subscriptionTableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!dynamoItem) {
        throw new Error("Subscription not found in dynamo");
    }

    return dynamoItem;
};

export const deleteAvlProducerSubscription = async (subscriptionTableName: string, subscriptionId: string) => {
    await deleteDynamoItem(subscriptionTableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });
};

/**
 * Deletes all associated resources for an AVL consumer subscription before deleting the subscription itself
 */
export const deleteAvlConsumerSubscription = async (
    subscriptionTableName: string,
    subscription: AvlConsumerSubscription,
) => {
    if (subscription.scheduleName) {
        const schedulerClient = createSchedulerClient();
        await schedulerClient.send(new DeleteScheduleCommand({ Name: subscription.scheduleName }));
        schedulerClient.destroy();
    }

    if (subscription.eventSourceMappingUuid) {
        const lambdaClient = createLambdaClient();
        await lambdaClient.send(new DeleteEventSourceMappingCommand({ UUID: subscription.eventSourceMappingUuid }));
        lambdaClient.destroy();
    }

    if (subscription.queueUrl) {
        const sqsClient = createSqsClient();
        await sqsClient.send(new DeleteQueueCommand({ QueueUrl: subscription.queueUrl }));
        sqsClient.destroy();
    }

    if (subscription.queueAlarmName) {
        const cloudWatchClient = createCloudWatchClient();
        await cloudWatchClient.send(new DeleteAlarmsCommand({ AlarmNames: [subscription.queueAlarmName] }));
        cloudWatchClient.destroy();
    }

    await deleteDynamoItem(subscriptionTableName, {
        PK: subscription.PK,
        SK: subscription.SK,
    });
};
