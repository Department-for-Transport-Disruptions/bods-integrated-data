import { DynamoDBClient, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
import { chunkArray } from "./utils";

const DYNAMO_DB_MAX_BATCH_SIZE = 25; // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/BatchWriteItemCommand/

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

export const putDynamoItems = async <T extends Record<string, unknown>>(
    tableName: string,
    records: {
        pk: string;
        sk: string;
        tableItems: T;
    }[],
) => {
    const recordChunks = chunkArray(records, DYNAMO_DB_MAX_BATCH_SIZE);

    await Promise.all(
        recordChunks.map((chunk) =>
            dynamoDbDocClient.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [tableName]: chunk.map((record) => ({
                            PutRequest: {
                                Item: {
                                    PK: record.pk,
                                    SK: record.sk,
                                    ...record.tableItems,
                                },
                            },
                        })),
                    },
                }),
            ),
        ),
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
    }

    return dbData.Items;
};
