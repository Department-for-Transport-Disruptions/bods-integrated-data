import { z } from "zod";
import { avlSubscriptionStatusesSchema } from "./avl-subscribe.schema";

export const avlConsumerSubscriptionSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    subscriptionId: z.string(),
    status: avlSubscriptionStatusesSchema,
    url: z.string().url(),
    requestorRef: z.string(),
    heartbeatInterval: z.string(),
    initialTerminationTime: z.string(),
    requestTimestamp: z.string(),
    producerSubscriptionIds: z.string(),
    heartbeatAttempts: z.number(),
    lastRetrievedAvlId: z.number().optional(),
    queueUrl: z.string(),
    eventSourceMappingUuid: z.string(),
    scheduleName: z.string(),
});

export type AvlConsumerSubscription = z.infer<typeof avlConsumerSubscriptionSchema>;

export const avlConsumerSubscriptionsSchema = z.array(avlConsumerSubscriptionSchema);
