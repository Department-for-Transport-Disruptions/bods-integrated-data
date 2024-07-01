import { z } from "zod";

export const terminateSubscriptionRequestSchema = z.object({
    TerminateSubscriptionRequest: z.object({
        RequestTimestamp: z.string(),
        RequestorRef: z.string(),
        MessageIdentifier: z.string(),
        SubscriptionRef: z.string(),
    }),
});

export const terminateSubscriptionResponseSchema = z.object({
    TerminateSubscriptionResponse: z.object({
        TerminationResponseStatus: z.object({
            ResponseTimestamp: z.string(),
            SubscriptionRef: z.string(),
            Status: z.string(),
        }),
    }),
});
