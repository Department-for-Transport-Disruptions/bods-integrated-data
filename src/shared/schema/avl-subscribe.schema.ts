import { z } from "zod";
import { avlSubscriptionStatuses } from "../constants";

export const avlSubscribeMessageSchema = z.object({
    dataProducerEndpoint: z.string().url(),
    description: z.string(),
    shortDescription: z.string(),
    username: z.string(),
    password: z.string(),
    requestorRef: z.string().nullish(),
    subscriptionId: z.string(),
    publisherId: z.string(),
});

export type AvlSubscribeMessage = z.infer<typeof avlSubscribeMessageSchema>;

export const avlSubscriptionRequestSchema = z.object({
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

export type AvlSubscriptionRequest = z.infer<typeof avlSubscriptionRequestSchema>;

export const avlSubscriptionResponseSchema = z.object({
    SubscriptionResponse: z.object({
        ResponseTimestamp: z.string(),
        ResponderRef: z.coerce.string().optional(),
        RequestMessageRef: z.coerce.string().optional(),
        ResponseStatus: z.object({
            ResponseTimestamp: z.string(),
            SubscriberRef: z.coerce.string().optional(),
            SubscriptionRef: z.coerce.string().optional(),
            Status: z.coerce.boolean(),
        }),
        ServiceStartedTime: z.string().optional(),
    }),
});

export type AvlSubscriptionResponse = z.infer<typeof avlSubscriptionResponseSchema>;

export const avlSubscriptionStatusesSchema = z.enum(avlSubscriptionStatuses);

export type AvlSubscriptionStatuses = z.infer<typeof avlSubscriptionStatusesSchema>;

export const avlSubscriptionSchema = z.object({
    PK: z.string(),
    url: z.string().url(),
    description: z.string(),
    shortDescription: z.string(),
    status: avlSubscriptionStatusesSchema,
    requestorRef: z.string().nullish(),
    heartbeatLastReceivedDateTime: z.string().nullish(),
    serviceStartDatetime: z.string().nullish(),
    serviceEndDatetime: z.string().nullish(),
    publisherId: z.string().nullish(),
    lastAvlDataReceivedDateTime: z.string().nullish(),
    lastModifiedDateTime: z.string().nullish(),
});

export type AvlSubscription = z.infer<typeof avlSubscriptionSchema>;

export const avlSubscriptionSchemaTransformed = avlSubscriptionSchema.transform((data) => ({
    subscriptionId: data.PK,
    ...data,
}));

export const avlSubscriptionsSchema = z.array(avlSubscriptionSchema);

export const avlUpdateBodySchema = z.object({
    dataProducerEndpoint: z.string().url(),
    description: z.string().nullish(),
    shortDescription: z.string().nullish(),
    username: z.string(),
    password: z.string(),
});

export type AvlUpdateBody = z.infer<typeof avlUpdateBodySchema>;
