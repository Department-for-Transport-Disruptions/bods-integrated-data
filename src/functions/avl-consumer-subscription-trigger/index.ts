import type { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import {
    AvlSubscriptionTriggerMessage,
    subscriptionTriggerMessageSchema,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { sendBatchMessage } from "@bods-integrated-data/shared/sqs";
import { ScheduledHandler } from "aws-lambda";

export const handler: ScheduledHandler<AvlSubscriptionTriggerMessage> = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { subscriptionPK, frequency, queueUrl } = subscriptionTriggerMessageSchema.parse(event.detail);

        const entries: SendMessageBatchRequestEntry[] = [];

        for (let i = 0, delay = frequency; delay <= 60; i++, delay += frequency) {
            entries.push({
                Id: i.toString(),
                DelaySeconds: delay,
                MessageBody: JSON.stringify({ subscriptionPK }),
            });
        }

        await sendBatchMessage(queueUrl, entries);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with AVL Consumer Subscription Trigger Lambda");
        }

        throw e;
    }
};
