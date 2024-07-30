import { z } from "zod";
import { avlValidationErrorLevels } from "../constants";

export const avlValidationErrorSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    details: z.string(),
    filename: z.string(),
    itemIdentifier: z.string().nullish(),
    level: z.enum(avlValidationErrorLevels),
    lineRef: z.string().nullish(),
    name: z.string(),
    operatorRef: z.string().nullish(),
    recordedAtTime: z.string().nullish(),
    responseTimestamp: z.string().nullish(),
    timeToExist: z.number(),
    vehicleJourneyRef: z.string().nullish(),
    vehicleRef: z.string().nullish(),
});

export type AvlValidationError = z.infer<typeof avlValidationErrorSchema>;
