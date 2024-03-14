import { z } from "zod";

export const operatorSchema = z.object({
    NationalOperatorCode: z.string(),
    OperatorShortName: z.string(),
    "@_id": z.string(),
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

export const routeSectionSchema = z.object({
    RouteLink: z.object({
        "@_id": z.string(),
        Track: z.object({
            Mapping: z.object({
                Location: z.array(
                    z.object({
                        Translation: z.object({
                            Latitude: z.coerce.number(),
                            Longitude: z.coerce.number(),
                        }),
                    }),
                ),
            }),
        }),
    }),
});

export type RouteSection = z.infer<typeof routeSectionSchema>;

export const serviceSchema = z.object({
    ServiceCode: z.string(),
    OperatingPeriod: operatingPeriodSchema,
    OperatingProfile: operatingProfileSchema.optional(),
    Lines: z.object({
        Line: z.array(
            z.object({
                "@_id": z.string(),
                LineName: z.string(),
            }),
        ),
    }),
    Mode: z.string().default("bus"),
    RegisteredOperatorRef: z.string(),
});

export type Service = z.infer<typeof serviceSchema>;

export const vehicleJourneySchema = z.object({
    VehicleJourneyCode: z.string(),
    OperatingProfile: operatingProfileSchema.optional(),
    ServiceRef: z.string(),
    LineRef: z.string(),
});

export type VehicleJourney = z.infer<typeof vehicleJourneySchema>;

export const stopSchema = z.object({
    StopPointRef: z.coerce.string(),
    CommonName: z.string(),
    Location: z
        .object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        })
        .optional(),
});

export type TxcStop = z.infer<typeof stopSchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: z.array(operatorSchema),
        }),
        RouteSections: z.object({
            RouteSection: z.array(routeSectionSchema),
        }),
        Services: z.object({
            Service: z.array(serviceSchema),
        }),
        VehicleJourneys: z.object({
            VehicleJourney: z.array(vehicleJourneySchema),
        }),
        StopPoints: z.object({
            AnnotatedStopPointRef: z.array(stopSchema),
        }),
    }),
});
