import { z } from "zod";
import {
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createNmTokenValidation,
    createSubscriptionIdArrayValidation,
} from "../validation";
import { avlSubscriptionStatusesSchema } from "./avl-subscribe.schema";

const subscriptionsQueryParamsSchema = z.object({
    boundingBox: createBoundingBoxValidation("boundingBox").optional(),
    operatorRef: createNmTokenArrayValidation("operatorRef").optional(),
    vehicleRef: createNmTokenValidation("vehicleRef").optional(),
    lineRef: createNmTokenValidation("lineRef").optional(),
    producerRef: createNmTokenValidation("producerRef").optional(),
    originRef: createNmTokenValidation("originRef").optional(),
    destinationRef: createNmTokenValidation("destinationRef").optional(),
    subscriptionId: createSubscriptionIdArrayValidation("subscriptionId"),
});

export type AvlConsumerQueryParams = z.infer<typeof subscriptionsQueryParamsSchema>;

export const avlConsumerSubscriptionSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    subscriptionId: z.string(),
    status: avlSubscriptionStatusesSchema,
    url: z.string().url(),
    requestorRef: z.string(),
    updateInterval: z.string(),
    heartbeatInterval: z.string(),
    initialTerminationTime: z.string(),
    requestTimestamp: z.string(),
    heartbeatAttempts: z.number(),
    lastRetrievedAvlId: z.number(),
    queueUrl: z.string().url().optional(),
    queueAlarmName: z.string().optional(),
    eventSourceMappingUuid: z.string().optional(),
    scheduleName: z.string().optional(),
    queryParams: subscriptionsQueryParamsSchema,
});

export type AvlConsumerSubscription = z.infer<typeof avlConsumerSubscriptionSchema>;

export const avlConsumerSubscriptionsSchema = z.array(avlConsumerSubscriptionSchema);
