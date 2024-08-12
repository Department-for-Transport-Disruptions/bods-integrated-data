import { z } from "zod";

export const terminateSubscriptionRequestSchema = z.object({
    TerminateSubscriptionRequest: z.object({
        RequestTimestamp: z.string(),
        RequestorRef: z.string(),
        MessageIdentifier: z.string(),
        SubscriptionRef: z.string(),
    }),
});

export type TerminateSubscriptionRequest = z.infer<typeof terminateSubscriptionRequestSchema>;

export const terminateSubscriptionResponseSchema = z.object({
    TerminateSubscriptionResponse: z.object({
        ResponseTimestamp: z.string().optional(),
        TerminationResponseStatus: z.object({
            ResponseTimestamp: z.string().optional(),
            SubscriptionRef: z.string(),
            Status: z.coerce.string(),
        }),
    }),
});
