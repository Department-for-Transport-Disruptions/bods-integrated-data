import type { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import {
    AvlSubscriptionDataSenderMessage,
    subscriptionTriggerMessageSchema,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { sendBatchMessage } from "@bods-integrated-data/shared/sqs";
import { ScheduledHandler } from "aws-lambda";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

const LAMBDA_TRIGGER_FREQUENCY_IN_SECONDS = 60;
const HEARTBEAT_FREQUENCY_IN_SECONDS = 30;

export const handler: ScheduledHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { subscriptionPK, SK, frequencyInSeconds, queueUrl } = subscriptionTriggerMessageSchema.parse(event);

        const entries: SendMessageBatchRequestEntry[] = [];

        for (let delay = 0; delay < LAMBDA_TRIGGER_FREQUENCY_IN_SECONDS; delay += frequencyInSeconds) {
            const dataSenderMessage: AvlSubscriptionDataSenderMessage = {
                subscriptionPK,
                SK,
                messageType: "data",
            };

            entries.push({
                Id: entries.length.toString(),
                DelaySeconds: delay,
                MessageBody: JSON.stringify(dataSenderMessage),
            });
        }

        for (let delay = 0; delay < LAMBDA_TRIGGER_FREQUENCY_IN_SECONDS; delay += HEARTBEAT_FREQUENCY_IN_SECONDS) {
            const dataSenderMessage: AvlSubscriptionDataSenderMessage = {
                subscriptionPK,
                SK,
                messageType: "heartbeat",
            };

            entries.push({
                Id: entries.length.toString(),
                DelaySeconds: delay,
                MessageBody: JSON.stringify(dataSenderMessage),
            });
        }

        await sendBatchMessage(queueUrl, entries);
    } catch (e) {
        if (e instanceof ZodError) {
            const validationError = fromZodError(e);
            logger.error(e, `Invalid message: ${validationError.toString()}`);
        } else if (e instanceof Error) {
            logger.error(e, "There was a problem with AVL Consumer Subscription Trigger Lambda");
        }

        throw e;
    }
};
