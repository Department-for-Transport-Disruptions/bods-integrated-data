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
    heartbeatAttempts: z.number(),
    lastRetrievedAvlId: z.number(),
    queueUrl: z.union([z.literal(""), z.string().url()]),
    eventSourceMappingUuid: z.string(),
    scheduleName: z.string(),
    queryParams: z.object({
        boundingBox: z.number().array().min(4).max(4).optional(),
        operatorRef: z.string().min(1).array().optional(),
        vehicleRef: z.string().min(1).optional(),
        lineRef: z.string().min(1).optional(),
        producerRef: z.string().min(1).optional(),
        originRef: z.string().min(1).optional(),
        destinationRef: z.string().min(1).optional(),
        producerSubscriptionIds: z.string().min(1).array().min(1).max(5),
    }),
});

export type AvlConsumerSubscription = z.infer<typeof avlConsumerSubscriptionSchema>;

export const avlConsumerSubscriptionsSchema = z.array(avlConsumerSubscriptionSchema);
