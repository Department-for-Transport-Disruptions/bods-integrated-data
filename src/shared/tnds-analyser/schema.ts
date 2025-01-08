import { z } from "zod";
import {
    allowedFirstStopActivity,
    allowedLastStopActivity,
    observationCategory,
    observationImportance,
    observationType,
} from "./constants";

export const observationSchema = z.object({
    PK: z.string(),
    SK: z.string().uuid(),
    importance: z.enum(observationImportance),
    category: z.enum(observationCategory),
    observation: z.enum(observationType),
    registrationNumber: z.string(),
    service: z.string(),
    details: z.string(),
});

export type Observation = z.infer<typeof observationSchema>;

const allowedLastStopActivitySchema = z.enum(allowedLastStopActivity);

export type AllowedLastStopActivity = z.infer<typeof allowedLastStopActivitySchema>;

const allowedFirstStopActivitySchema = z.enum(allowedFirstStopActivity);

export type AllowedFirstStopActivity = z.infer<typeof allowedFirstStopActivitySchema>;
