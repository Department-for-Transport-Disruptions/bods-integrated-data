import { getDate } from "@bods-integrated-data/shared/dates";
import { deleteDynamoItems, scanDynamo } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_OBSERVATION_TABLE_NAME } = process.env;

    if (!TNDS_OBSERVATION_TABLE_NAME) {
        throw new Error("Missing env vars - TNDS_ANALYSIS_TABLE_NAME must be set");
    }

    let dynamoScanStartKey: Record<string, string> | undefined = undefined;

    do {
        const dynamoScanOutput = await scanDynamo({
            TableName: TNDS_OBSERVATION_TABLE_NAME,
            ExclusiveStartKey: dynamoScanStartKey,
        });
        dynamoScanStartKey = dynamoScanOutput.LastEvaluatedKey;

        if (dynamoScanOutput.Items) {
            await deleteDynamoItems(TNDS_OBSERVATION_TABLE_NAME, dynamoScanOutput.Items);
        }
    } while (dynamoScanStartKey);

    return {
        date: getDate().format("YYYYMMDD"),
    };
};
