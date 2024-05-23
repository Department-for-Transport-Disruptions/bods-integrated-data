import { z } from "zod";
import { subscriptionSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";

export const tflLineSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    modeName: z.string().optional(),
    created: z.string().datetime().optional(),
    modified: z.string().datetime().optional(),
});

export const tflLinesSchema = z.array(tflLineSchema);

export type TflLinesSchema = z.infer<typeof tflLinesSchema>;