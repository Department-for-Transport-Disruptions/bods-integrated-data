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
        url: data.url,
        description: data.description,
        shortDescription: data.shortDescription,
        status: data.status,
        requestorRef: data.requestorRef ?? null,
    }));

export const subscriptionsSchema = z.array(subscriptionSchema);
