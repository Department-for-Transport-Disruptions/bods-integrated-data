import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DYNAMO_DB_MAX_BATCH_SIZE } from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { program } from "commander";
import { recursiveScan, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";
import { createDynamoDbDocClient } from "../utils/awsClients";

program
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        const dynamoDbClient = createDynamoDbDocClient(stage);
        const tableName = `integrated-data-gtfs-trip-maps-table-${stage}`;
        const tableItems = await recursiveScan(dynamoDbClient, { TableName: tableName });
        logger.info(`Deleting ${tableItems.length} items`);

        if (tableItems.length) {
            const itemChunks = chunkArray(tableItems, DYNAMO_DB_MAX_BATCH_SIZE);

            for await (const chunk of itemChunks) {
                await dynamoDbClient.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [tableName]: chunk.map((item) => ({
                                DeleteRequest: {
                                    Key: {
                                        PK: item.PK,
                                        SK: item.SK,
                                    },
                                },
                            })),
                        },
                    }),
                );
            }
        }

        dynamoDbClient.destroy();
    })
    .parse();
