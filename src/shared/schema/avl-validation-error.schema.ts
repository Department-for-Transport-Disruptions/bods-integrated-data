import { z } from "zod";

export const avlValidationErrorSchema = z.object({
    PK: z.string(),
    timeToExist: z.number(),
    timestamp: z.number(),
    field: z.string(),
    errorMessage: z.string(),
});

export type AvlValidationError = z.infer<typeof avlValidationErrorSchema>;
