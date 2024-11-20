import { DeleteAlarmsCommand } from "@aws-sdk/client-cloudwatch";
import { DeleteEventSourceMappingCommand } from "@aws-sdk/client-lambda";
import { DeleteScheduleCommand } from "@aws-sdk/client-scheduler";
import { DeleteQueueCommand } from "@aws-sdk/client-sqs";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DYNAMO_DB_MAX_BATCH_SIZE } from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { avlConsumerSubscriptionsSchema } from "@bods-integrated-data/shared/schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { program } from "commander";
import { STAGES, STAGE_OPTION, recursiveScan, withUserPrompts } from "../utils";
import {
    createCloudWatchClient,
    createDynamoDbDocClient,
    createLambdaClient,
    createSchedulerClient,
    createSqsClient,
} from "../utils/awsClients";

// this script is useful for cleaning up old subscriptions such as after load testing
program
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        const dynamoDbClient = createDynamoDbDocClient(stage);
        const tableName = `integrated-data-avl-consumer-subscription-table-${stage}`;
        const tableItems = await recursiveScan(dynamoDbClient, { TableName: tableName });

        // use safeParse to ensure the script executes even if the data is not in the expected format
        const subscriptions = avlConsumerSubscriptionsSchema.safeParse(tableItems).data || [];
        const inactiveSubscriptions = subscriptions.filter((s) => s.status === "inactive");

        logger.info(`${subscriptions.length} inactive subscriptions`);

        const subscriptionsWithSchedules = inactiveSubscriptions.filter((s) => s.scheduleName);
        const subscriptionsWithEventSourceMappings = inactiveSubscriptions.filter((s) => s.eventSourceMappingUuid);
        const subscriptionsWithQueues = inactiveSubscriptions.filter((s) => s.queueUrl);
        const subscriptionsWithQueueAlarms = inactiveSubscriptions.filter((s) => s.queueAlarmName);

        if (subscriptionsWithSchedules.length) {
            logger.info(`Deleting ${subscriptionsWithSchedules.length} lingering queues`);
            const schedulerClient = createSchedulerClient(stage);

            const deleteScheduleRequests = subscriptionsWithSchedules.map((s) =>
                schedulerClient.send(new DeleteScheduleCommand({ Name: s.scheduleName })),
            );

            await Promise.all(deleteScheduleRequests);
            schedulerClient.destroy();
        }

        if (subscriptionsWithEventSourceMappings.length) {
            logger.info(`Deleting ${subscriptionsWithEventSourceMappings.length} lingering event source mappings`);
            const lambdaClient = createLambdaClient(stage);

            const deleteEventSourceMappingRequests = subscriptionsWithEventSourceMappings.map((s) =>
                lambdaClient.send(new DeleteEventSourceMappingCommand({ UUID: s.eventSourceMappingUuid })),
            );

            await Promise.all(deleteEventSourceMappingRequests);
            lambdaClient.destroy();
        }

        if (subscriptionsWithQueues.length) {
            logger.info(`Deleting ${subscriptionsWithQueues.length} lingering queues`);
            const sqsClient = createSqsClient(stage);

            const deleteQueueRequests = subscriptionsWithQueues.map((s) =>
                sqsClient.send(new DeleteQueueCommand({ QueueUrl: s.queueUrl })),
            );

            await Promise.all(deleteQueueRequests);
            sqsClient.destroy();
        }

        if (subscriptionsWithQueueAlarms.length) {
            logger.info(`Deleting ${subscriptionsWithQueueAlarms.length} lingering alarms`);
            const cloudWatchClient = createCloudWatchClient(stage);
            const alarmNames = subscriptionsWithQueueAlarms.map((s) => s.queueAlarmName) as string[];

            await cloudWatchClient.send(new DeleteAlarmsCommand({ AlarmNames: alarmNames }));
            cloudWatchClient.destroy();
        }

        if (inactiveSubscriptions.length) {
            const itemChunks = chunkArray(subscriptions, DYNAMO_DB_MAX_BATCH_SIZE);

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
