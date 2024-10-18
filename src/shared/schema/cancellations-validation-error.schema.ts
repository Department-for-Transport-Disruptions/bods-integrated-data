import { z } from "zod";

export const cancellationsValidationErrorSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    timeToExist: z.number(),
    details: z.string(),
    filename: z.string(),
    name: z.string(),
    responseTimestamp: z.string().nullish(),
    responseMessageIdentifier: z.string().nullish(),
    producerRef: z.string().nullish(),
    situationNumber: z.string().nullish(),
    version: z.string().nullish(),
});

export type CancellationsValidationError = z.infer<typeof cancellationsValidationErrorSchema>;
