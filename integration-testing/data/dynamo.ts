import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DeleteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    NativeAttributeValue,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamoDbDocClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: "eu-west-2",
    }),
);

export const deleteDynamoItem = async (tableName: string, key: Record<string, NativeAttributeValue>) => {
    await dynamoDbDocClient.send(
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
    const data = await dynamoDbDocClient.send(
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
