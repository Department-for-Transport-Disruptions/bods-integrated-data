import { z } from "zod";
import { subscriptionStatuses } from "../constants";
import { createStringLengthValidation } from "../validation";

export const cancellationsSubscribeMessageSchema = z.object(
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
        operatorRefs: createStringLengthValidation("operatorRef").array().nullish(),
    },
    {
        message: "Body must be an object with required properties",
    },
);

export type CancellationsSubscribeMessage = z.infer<typeof cancellationsSubscribeMessageSchema>;

export const cancellationsSubscriptionStatusesSchema = z.enum(subscriptionStatuses);

export type CancellationsSubscriptionStatus = z.infer<typeof cancellationsSubscriptionStatusesSchema>;

export const cancellationsSubscriptionSchema = z.object({
    PK: z.string(),
    url: z.string().url(),
    description: z.string(),
    shortDescription: z.string(),
    status: cancellationsSubscriptionStatusesSchema,
    requestorRef: z.string().nullish(),
    heartbeatLastReceivedDateTime: z.string().nullish(),
    serviceStartDatetime: z.string().nullish(),
    serviceEndDatetime: z.string().nullish(),
    publisherId: z.string(),
    operatorRefs: z.string().array().nullish(),
    lastCancellationsDataReceivedDateTime: z.string().nullish(),
    lastModifiedDateTime: z.string().nullish(),
    apiKey: z.string(),
    lastResubscriptionTime: z.string().nullish(),
});

export type CancellationsSubscription = z.infer<typeof cancellationsSubscriptionSchema>;

export const cancellationsSubscriptionsSchema = z.array(cancellationsSubscriptionSchema);

export const cancellationsSubscriptionRequestSchema = z.object({
    Siri: z.object({
        SubscriptionRequest: z.object({
            RequestTimestamp: z.string(),
            ConsumerAddress: z.string().url(),
            RequestorRef: z.string(),
            MessageIdentifier: z.string(),
            SubscriptionContext: z.object({
                HeartbeatInterval: z.string(),
            }),
            SituationExchangeSubscriptionRequest: z.object({
                SubscriberRef: z.string(),
                SubscriptionIdentifier: z.string(),
                InitialTerminationTime: z.string(),
                SituationExchangeRequest: z.object({
                    RequestTimestamp: z.string(),
                    "@_version": z.string().nullish(),
                    OperatorRef: z.string().nullish(),
                }),
            }),
            IncrementalUpdates: z.literal(true),
        }),
    }),
});

export type CancellationsSubscriptionRequest = z.infer<typeof cancellationsSubscriptionRequestSchema>;

export const cancellationsSubscriptionResponseSchema = z.object({
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

export type CancellationsSubscriptionResponse = z.infer<typeof cancellationsSubscriptionResponseSchema>;
