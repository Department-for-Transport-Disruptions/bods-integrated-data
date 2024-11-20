import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    QueryCommandInput,
    ScanCommand,
    ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
import { chunkArray } from "./utils";

export const DYNAMO_DB_MAX_BATCH_SIZE = 25; // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/BatchWriteItemCommand/

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

export const putDynamoItems = async <T extends Record<string, unknown>>(tableName: string, items: T[]) => {
    const itemChunks = chunkArray(items, DYNAMO_DB_MAX_BATCH_SIZE);

    for await (const chunk of itemChunks) {
        await dynamoDbDocClient.send(
            new BatchWriteCommand({
                RequestItems: {
                    [tableName]: chunk.map((item) => ({
                        PutRequest: {
                            Item: item,
                        },
                    })),
                },
            }),
        );
    }
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

export const recursiveScan = async <T extends Record<string, unknown>>(
    scanCommandInput: ScanCommandInput,
): Promise<T[]> => {
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
        ] as T[];
    }

    return dbData.Items as T[];
};

export const recursiveQuery = async <T extends Record<string, unknown>>(
    queryCommandInput: QueryCommandInput,
): Promise<T[]> => {
    const dbData = await dynamoDbDocClient.send(new QueryCommand(queryCommandInput));

    if (!dbData.Items) {
        return [];
    }

    if (dbData.LastEvaluatedKey) {
        return [
            ...dbData.Items,
            ...(await recursiveQuery({
                ...queryCommandInput,
                ExclusiveStartKey: dbData.LastEvaluatedKey,
            })),
        ] as T[];
    }

    return dbData.Items as T[];
};
