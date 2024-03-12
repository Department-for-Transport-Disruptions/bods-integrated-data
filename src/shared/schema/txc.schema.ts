import { z } from "zod";

export const operatorSchema = z.object({
    NationalOperatorCode: z.string(),
    OperatorShortName: z.string(),
});

export type Operator = z.infer<typeof operatorSchema>;

export const operatingPeriodSchema = z.object({
    StartDate: z.string(),
    EndDate: z.string().optional(),
});

export type OperatingPeriod = z.infer<typeof operatingPeriodSchema>;

export const operatingProfileSchema = z.object({
    RegularDayType: z.object({
        DaysOfWeek: z.object({
            Monday: z.string().optional(),
            Tuesday: z.string().optional(),
            Wednesday: z.string().optional(),
            Thursday: z.string().optional(),
            Friday: z.string().optional(),
            Saturday: z.string().optional(),
            Sunday: z.string().optional(),
            MondayToFriday: z.string().optional(),
            MondayToSaturday: z.string().optional(),
            MondayToSunday: z.string().optional(),
            NotSaturday: z.string().optional(),
            Weekend: z.string().optional(),
        }),
    }),
});

export type OperatingProfile = z.infer<typeof operatingProfileSchema>;

export const serviceSchema = z.object({
    ServiceCode: z.string(),
    OperatingPeriod: operatingPeriodSchema,
    OperatingProfile: operatingProfileSchema.optional(),
});

export type Service = z.infer<typeof serviceSchema>;

export const vehicleJourneySchema = z.object({
    OperatingProfile: operatingProfileSchema.optional(),
    ServiceRef: z.string(),
});

export type VehicleJourney = z.infer<typeof vehicleJourneySchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: z.array(operatorSchema),
        }),
        Services: z.object({
            Service: z.array(serviceSchema),
        }),
        VehicleJourneys: z.object({
            VehicleJourney: z.array(vehicleJourneySchema),
        }),
    }),
});
