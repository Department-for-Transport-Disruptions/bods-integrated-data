import { z } from "zod";
import { observationCategory, observationImportance, observationType } from "./constants";

export const observationSchema = z.object({
    importance: z.enum(observationImportance),
    category: z.enum(observationCategory),
    observation: z.enum(observationType),
    serviceCode: z.string(),
    lineName: z.string(),
    details: z.string().optional(),
    extraColumns: z.record(z.string(), z.string()).optional(),
});

export type Observation = z.infer<typeof observationSchema>;

export const dynamoDbObservationSchema = observationSchema.and(
    z.object({
        PK: z.string(),
        SK: z.string(),
        dataSource: z.string(),
        noc: z.string(),
        region: z.string(),
    }),
);

export type DynamoDbObservation = z.infer<typeof dynamoDbObservationSchema>;

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
    "Serviced organisation data is out of date": z.number(),
});

export type ObservationSummary = z.infer<typeof observationSummarySchema>;

export type NaptanStopMap = Record<string, { stopType?: string | null; regions: string[] }>;
