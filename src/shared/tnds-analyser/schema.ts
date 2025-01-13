import { z } from "zod";
import { observationCategory, observationImportance, observationType } from "./constants";

export const observationSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    timeToExist: z.number(),
    dataSource: z.string(),
    noc: z.string(),
    region: z.string(),
    importance: z.enum(observationImportance),
    category: z.enum(observationCategory),
    observation: z.enum(observationType),
    registrationNumber: z.string(),
    service: z.string(),
    details: z.string(),
});

export type Observation = z.infer<typeof observationSchema>;

export const observationSummarySchema = z.object({
    File: z.string(),
    "Data Source": z.string(),
    "Total observations": z.number(),
    "Critical observations": z.number(),
    "Advisory observations": z.number(),
    "No timing point for more than 15 minutes": z.number(),
    "First stop is not a timing point": z.number(),
    "Last stop is not a timing point": z.number(),
    "Last stop is pick up only": z.number(),
    "First stop is set down only": z.number(),
    "Stop not found in NaPTAN": z.number(),
    "Incorrect stop type": z.number(),
    "Missing journey code": z.number(),
    "Duplicate journey code": z.number(),
    "Duplicate journey": z.number(),
    "Missing bus working number": z.number(),
    "Serviced organisation out of date": z.number(),
});

export type ObservationSummary = z.infer<typeof observationSummarySchema>;
