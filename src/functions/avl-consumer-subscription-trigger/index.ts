import type { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import {} from "@bods-integrated-data/shared/api";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { sendBatchMessage } from "@bods-integrated-data/shared/sqs";
import { ScheduledHandler } from "aws-lambda";
import { z } from "zod";

const eventMessageSchema = z.object({
    subscriptionPK: z.string(),
    frequency: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
    queueUrl: z.string(),
});

export type AvlConsumerSubscriptionTrigger = z.infer<typeof eventMessageSchema>;

export const handler: ScheduledHandler<AvlConsumerSubscriptionTrigger> = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { subscriptionPK, frequency, queueUrl } = eventMessageSchema.parse(event.detail);

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
