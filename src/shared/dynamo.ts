import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

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

export const recursiveScan = async (scanCommandInput: ScanCommandInput): Promise<Record<string, unknown>[]> => {
    const dbData = await dynamoDbDocClient.send(new ScanCommand(scanCommandInput));

    if (!dbData.Items) {
        return [];
    }

    if (dbData.LastEvaluatedKey) {
        return [
            ...dbData.Items,
            ...(await recursiveScan({
                ...scanCommandInput,
                ExclusiveStartKey: dbData.LastEvaluatedKey,
            })),
        ];
    } else {
        return dbData.Items;
    }
};
