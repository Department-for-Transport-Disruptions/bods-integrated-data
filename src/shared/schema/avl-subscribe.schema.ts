import { z } from "zod";

export const avlSubscribeMessageSchema = z.object({
    dataProducerEndpoint: z.string().url(),
    description: z.string(),
    shortDescription: z.string(),
    username: z.string(),
    password: z.string(),
    requestorRef: z.string().optional(),
});

export type AvlSubscribeMessage = z.infer<typeof avlSubscribeMessageSchema>;

export const subscriptionRequestSchema = z.object({
    SubscriptionRequest: z.object({
        RequestTimeStamp: z.string(),
        Address: z.string().url(),
        RequestorRef: z.string(),
        MessageIdentifier: z.string(),
        SubscriptionRequestContext: z.object({
            HeartbeatInterval: z.string(),
        }),
        VehicleMonitoringSubscriptionRequest: z.object({
            SubscriberRef: z.string(),
            SubscriptionIdentifier: z.string(),
            InitialTerminationTime: z.string(),
            VehicleMonitoringRequest: z.object({
                RequestTimestamp: z.string(),
            }),
        }),
    }),
});

export type SubscriptionRequest = z.infer<typeof subscriptionRequestSchema>;

export const subscriptionResponseSchema = z.object({
    SubscriptionResponse: z.object({
        ResponseTimestamp: z.string(),
        ResponderRef: z.string(),
        RequestMessageRef: z.string(),
        ResponseStatus: z.object({
            ResponseTimestamp: z.string(),
            RequestMessageRef: z.string(),
            SubscriptionRef: z.string(),
            Status: z.coerce.boolean(),
        }),
        ServiceStartedTime: z.string(),
    }),
});

export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;
