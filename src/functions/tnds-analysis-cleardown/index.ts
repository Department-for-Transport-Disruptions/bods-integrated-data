import { getDate } from "@bods-integrated-data/shared/dates";
import {
    createTable,
    deleteTable,
    waitUntilTableExists,
    waitUntilTableNotExists,
} from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_OBSERVATION_TABLE_NAME } = process.env;

    if (!TNDS_OBSERVATION_TABLE_NAME) {
        throw new Error("Missing env vars - TNDS_OBSERVATION_TABLE_NAME must be set");
    }

    try {
        await deleteTable({ TableName: TNDS_OBSERVATION_TABLE_NAME });
        await waitUntilTableNotExists(TNDS_OBSERVATION_TABLE_NAME);
    } catch (error) {
        if (error instanceof Error && error.name !== "ResourceNotFoundException") {
            throw error;
        }
    }

    await createTable({
        TableName: TNDS_OBSERVATION_TABLE_NAME,
        AttributeDefinitions: [
            { AttributeName: "PK", AttributeType: "S" },
            { AttributeName: "SK", AttributeType: "S" },
        ],
        KeySchema: [
            { AttributeName: "PK", KeyType: "HASH" },
            { AttributeName: "SK", KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST",
    });

    await waitUntilTableExists(TNDS_OBSERVATION_TABLE_NAME);

    return {
        date: getDate().format("YYYYMMDD"),
    };
};
