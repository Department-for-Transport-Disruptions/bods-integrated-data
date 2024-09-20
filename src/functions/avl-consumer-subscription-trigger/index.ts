import type { SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import { subscriptionTriggerMessageSchema } from "@bods-integrated-data/shared/avl-consumer/utils";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { sendBatchMessage } from "@bods-integrated-data/shared/sqs";
import { ScheduledHandler } from "aws-lambda";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export const handler: ScheduledHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { subscriptionPK, frequencyInSeconds, queueUrl } = subscriptionTriggerMessageSchema.parse(event);

        const entries: SendMessageBatchRequestEntry[] = [];

        for (let i = 0, delay = frequencyInSeconds; delay <= 60; i++, delay += frequencyInSeconds) {
            entries.push({
                Id: i.toString(),
                DelaySeconds: delay,
                MessageBody: JSON.stringify({ subscriptionPK }),
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
