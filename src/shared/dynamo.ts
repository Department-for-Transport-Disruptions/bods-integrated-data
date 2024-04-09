import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";

const dynamoDbDocClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: "eu-west-2",
        ...(process.env.IS_LOCAL === "true"
            ? {
                  endpoint: "http://localhost:4566",
              }
            : {}),
    }),
);

export const putDynamoItem = async (tableName: string, pk: string, sk: string, tableItems: Record<string, unknown>) => {
    await dynamoDbDocClient.send(
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

export const getDynamoItem = async (tableName: string, key: Record<string, NativeAttributeValue>) => {
    const data = await dynamoDbDocClient.send(
        new GetCommand({
            TableName: tableName,
            Key: key,
        }),
    );

    return data.Item ?? null;
};

export const updateDynamoItem = async (
    tableName: string,
    key: Record<string, NativeAttributeValue>,
    updateExpression: Record<string, unknown>,
) => {
    await dynamoDbDocClient.send(
        new UpdateCommand({
            TableName: tableName,
            Key: key,
            ...updateExpression,
        }),
    );
};
