import { z } from "zod";
import { avlSubscriptionStatuses } from "../constants";
import { createStringLengthValidation } from "../validation";

export const avlSubscribeMessageSchema = z.object(
    {
        dataProducerEndpoint: z
            .string({
                required_error: "dataProducerEndpoint is required",
                invalid_type_error: "dataProducerEndpoint must be a string",
            })
            .url({
                message: "dataProducerEndpoint must be a URL",
            }),
        description: createStringLengthValidation("description"),
        shortDescription: createStringLengthValidation("shortDescription"),
        username: createStringLengthValidation("username"),
        password: createStringLengthValidation("password"),
        requestorRef: createStringLengthValidation("requestorRef").nullish(),
        subscriptionId: createStringLengthValidation("subscriptionId"),
        publisherId: createStringLengthValidation("publisherId"),
    },
    {
        message: "Body must be an object with required properties",
    },
);

export type AvlSubscribeMessage = z.infer<typeof avlSubscribeMessageSchema>;

export const avlSubscriptionRequestSchema = z.object({
    Siri: z.object({
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
                    VehicleMonitoringDetailLevel: z.literal("normal"),
                    "@_version": z.string(),
                }),
            }),
        }),
    }),
});

export type AvlSubscriptionRequest = z.infer<typeof avlSubscriptionRequestSchema>;

export const avlSubscriptionResponseSchema = z.object({
    Siri: z.object({
        SubscriptionResponse: z.object({
            ResponseTimestamp: z.string(),
            ResponderRef: z.coerce.string().optional(),
            RequestMessageRef: z.coerce.string().optional(),
            ResponseStatus: z.object({
                ResponseTimestamp: z.string(),
                SubscriberRef: z.coerce.string().optional(),
                SubscriptionRef: z.coerce.string().optional(),
                Status: z.coerce.string(),
            }),
            ServiceStartedTime: z.string().optional(),
        }),
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
    publisherId: z.string(),
    lastAvlDataReceivedDateTime: z.string().nullish(),
    lastModifiedDateTime: z.string().nullish(),
    apiKey: z.string(),
    lastResubscriptionTime: z.string().nullish(),
});

export type AvlSubscription = z.infer<typeof avlSubscriptionSchema>;

export const avlSubscriptionSchemaTransformed = avlSubscriptionSchema.transform((data) => ({
    subscriptionId: data.PK,
    ...data,
}));

export const avlSubscriptionsSchema = z.array(avlSubscriptionSchema);

export const avlUpdateBodySchema = z.object(
    {
        dataProducerEndpoint: z
            .string({
                required_error: "dataProducerEndpoint is required",
                invalid_type_error: "dataProducerEndpoint must be a string",
            })
            .url({
                message: "dataProducerEndpoint must be a URL",
            }),
        description: createStringLengthValidation("description").nullish(),
        shortDescription: createStringLengthValidation("shortDescription").nullish(),
        username: createStringLengthValidation("username"),
        password: createStringLengthValidation("password"),
    },
    {
        message: "Body must be an object with required properties",
    },
);

export type AvlUpdateBody = z.infer<typeof avlUpdateBodySchema>;
