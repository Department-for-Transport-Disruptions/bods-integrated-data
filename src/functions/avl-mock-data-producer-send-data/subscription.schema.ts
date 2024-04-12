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

export const subscriptionsSchema = z.array(subscriptionSchema);
