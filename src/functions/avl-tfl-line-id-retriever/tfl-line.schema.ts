import { subscriptionSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { z } from "zod";

export const tflLineSchema = z.object({
    id: z.string(),
});

export const tflLinesSchema = z.array(tflLineSchema);

export type TflLinesSchema = z.infer<typeof tflLinesSchema>;
