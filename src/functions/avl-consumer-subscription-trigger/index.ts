import type { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import {} from "@bods-integrated-data/shared/api";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { sendBatchMessage } from "@bods-integrated-data/shared/sqs";
import { ScheduledHandler } from "aws-lambda";
import { z } from "zod";

const eventSchema = z.object({
    queueUrl: z.string(),
    frequency: z.literal(10).or(z.literal(15)).or(z.literal(20)).or(z.literal(30)),
    subscriptionId: z.string(),
});

export const handler: ScheduledHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const eventData = eventSchema.parse(event);

        const entries: SendMessageBatchRequestEntry[] = [];

        for (let delay = eventData.frequency; delay <= 60; delay += eventData.frequency) {
            entries.push({
                Id: entries.length.toString(),
                DelaySeconds: delay,
                MessageBody: JSON.stringify({
                    subscriptionId: eventData.subscriptionId,
                }),
            });
        }

        await sendBatchMessage(eventData.queueUrl, entries);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with AVL Consumer Subscription Trigger Lambda");
        }

        throw e;
    }
};
