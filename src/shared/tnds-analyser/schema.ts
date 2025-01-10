import { z } from "zod";
import { observationCategory, observationImportance, observationType } from "./constants";

export const observationSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    importance: z.enum(observationImportance),
    category: z.enum(observationCategory),
    observation: z.enum(observationType),
    registrationNumber: z.string(),
    service: z.string(),
    details: z.string(),
});

export type Observation = z.infer<typeof observationSchema>;

export const observationsSchema = z.array(observationSchema);
