import { deleteDynamoItems, recursiveScan } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { STAGE, TNDS_ANALYSIS_TABLE_NAME } = process.env;

    if (!STAGE || !TNDS_ANALYSIS_TABLE_NAME) {
        throw new Error("Missing env vars - STAGE and TNDS_ANALYSIS_TABLE_NAME must be set");
    }

    const tableName = `integrated-data-gtfs-trip-maps-table-${STAGE}`;
    const tableItems = await recursiveScan({ TableName: tableName });
    logger.info(`Deleting ${tableItems.length} items`);

    if (tableItems.length) {
        await deleteDynamoItems(tableName, tableItems);
    }
};
