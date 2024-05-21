import { z } from "zod";

export const avlSubscribeMessageSchema = z.object({
    dataProducerEndpoint: z.string().url(),
    description: z.string(),
    shortDescription: z.string(),
    username: z.string(),
    password: z.string(),
    requestorRef: z.string().optional(),
    subscriptionId: z.string().optional(),
});

export type AvlSubscribeMessage = z.infer<typeof avlSubscribeMessageSchema>;

export const subscriptionRequestSchema = z.object({
    SubscriptionRequest: z.object({
        RequestTimestamp: z.string(),
        ConsumerAddress: z.string().url(),
        RequestorRef: z.string(),
        MessageIdentifier: z.string(),
        SubscriptionContext: z.object({
            HeartbeatInterval: z.string(),
        }),
        VehicleMonitoringSubscriptionRequest: z.object({
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
        ResponderRef: z.string().optional(),
        RequestMessageRef: z.string().optional(),
        ResponseStatus: z.object({
            ResponseTimestamp: z.string(),
            SubscriberRef: z.string().optional(),
            SubscriptionRef: z.string().optional(),
            Status: z.coerce.boolean(),
        }),
        ServiceStartedTime: z.string().optional(),
    }),
});

export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;

export const subscriptionSchema = z.object({
    PK: z.string(),
    url: z.string().url(),
    description: z.string(),
    shortDescription: z.string(),
    status: z.string(),
    requestorRef: z.string().nullish(),
    heartbeatLastReceivedDateTime: z.string().nullish(),
    serviceStartDatetime: z.string().optional(),
    serviceEndDatetime: z.string().optional(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const subscriptionSchemaTransformed = subscriptionSchema.transform((data) => ({
    subscriptionId: data.PK,
    ...data,
}));

export const subscriptionsSchema = z.array(subscriptionSchema);
