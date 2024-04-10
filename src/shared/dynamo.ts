import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const dynamoDbDocClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: "eu-west-2",
        ...(process.env.IS_LOCAL === "true"
            ? {
                  endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
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
