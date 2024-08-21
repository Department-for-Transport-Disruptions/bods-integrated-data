import { z } from "zod";
import { avlSubscriptionStatusesSchema } from "./avl-subscribe.schema";

export const avlConsumerSubscriptionSchema = z.object({
    PK: z.string(),
    status: avlSubscriptionStatusesSchema,
    url: z.string().url(),
    requestorRef: z.string(),
    subscriptionId: z.string(),
    heartbeatInterval: z.string(),
    initialTerminationTime: z.string(),
    requestTimestamp: z.string(),
    subscriptionIds: z.string().array(),
});

export type AvlConsumerSubscription = z.infer<typeof avlConsumerSubscriptionSchema>;
