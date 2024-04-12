import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const dynamoDbDocClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: "eu-west-2",
        ...(process.env.IS_LOCAL === "true"
            ? {
                  endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://127.0.0.1:4566",
                  credentials: {
                      accessKeyId: "DUMMY",
                      secretAccessKey: "DUMMY",
                  },
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

export const updateDynamoItem = async (
    tableName: string,
    pk: string,
    sk: string,
    tableattr: string,
    tablevalue: unknown,
) => {
    await dynamoDbDocClient.send(
        new UpdateCommand({
            TableName: tableName,
            Key: {
                PK: pk,
                SK: sk,
            },
            UpdateExpression: "SET #attr = :value",
            ExpressionAttributeNames: {
                "#attr": tableattr,
            },
            ExpressionAttributeValues: {
                ":value": tablevalue,
            },
        }),
    );
};
