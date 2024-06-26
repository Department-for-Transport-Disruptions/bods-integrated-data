import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, NativeAttributeValue, DeleteCommand } from "@aws-sdk/lib-dynamodb";

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
