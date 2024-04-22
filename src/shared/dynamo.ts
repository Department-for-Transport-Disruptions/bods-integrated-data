import { DynamoDBClient, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const dynamoDbDocClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: "eu-west-2",
        ...(process.env.STAGE === "local"
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

export const getDynamoItem = async (tableName: string, key: Record<string, NativeAttributeValue>) => {
    const data = await dynamoDbDocClient.send(
        new GetCommand({
            TableName: tableName,
            Key: key,
        }),
    );

    return data.Item ?? null;
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
