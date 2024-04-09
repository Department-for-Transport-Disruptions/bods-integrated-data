import { z } from "zod";

export const subscriptionSchema = z
    .object({
        PK: z.string(),
        url: z.string().url(),
        description: z.string(),
        shortDescription: z.string(),
        status: z.string(),
        requestorRef: z.string().nullish(),
    })
    .transform((data) => ({
        subscriptionId: data.PK,
        ...data,
    }));

export type Subscription = z.infer<typeof subscriptionSchema>;

export const terminateSubscriptionRequestSchema = z.object({
    TerminateSubscriptionRequest: z.object({
        RequestTimeStamp: z.string(),
        RequestorRef: z.string(),
        MessageIdentifier: z.string(),
        SubscriptionRef: z.string(),
    }),
});

export const terminateSubscriptionResponseSchema = z.object({
    TerminateSubscriptionResponse: z.object({
        TerminateSubscriptionResponseStatus: z.object({
            ResponseTimeStamp: z.string(),
            SubscriptionRef: z.string(),
            Status: z.string(),
        }),
    }),
});
