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
        DaysOfWeek: z
            .object({
                Monday: z.literal("").optional(),
                Tuesday: z.literal("").optional(),
                Wednesday: z.literal("").optional(),
                Thursday: z.literal("").optional(),
                Friday: z.literal("").optional(),
                Saturday: z.literal("").optional(),
                Sunday: z.literal("").optional(),
                MondayToFriday: z.literal("").optional(),
                MondayToSaturday: z.literal("").optional(),
                MondayToSunday: z.literal("").optional(),
                NotSaturday: z.literal("").optional(),
                Weekend: z.literal("").optional(),
            })
            .or(z.literal(""))
            .optional(),
        HolidaysOnly: z.literal("").optional(),
    }),
});

export type OperatingProfile = z.infer<typeof operatingProfileSchema>;

const locationSchema = z.object({
    Translation: z
        .object({
            Latitude: z.coerce.number(),
            Longitude: z.coerce.number(),
        })
        .optional(),
    Latitude: z.coerce.number().optional(),
    Longitude: z.coerce.number().optional(),
});

const trackSchema = z.object({
    Mapping: z.object({
        Location: z.array(locationSchema),
    }),
});

const routeLinkSchema = z.object({
    Track: z.array(trackSchema).optional(),
});

export const routeSectionSchema = z.object({
    "@_id": z.string(),
    RouteLink: z.array(routeLinkSchema),
});

export type TxcRouteSection = z.infer<typeof routeSectionSchema>;

export const routeSchema = z.object({
    "@_id": z.string(),
    RouteSectionRef: z.array(z.string()),
});

export type TxcRoute = z.infer<typeof routeSchema>;

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
    StandardService: z.object({
        JourneyPattern: z.array(
            z.object({
                "@_id": z.string(),
                DestinationDisplay: z.string().optional(),
                RouteRef: z.string().optional(),
            }),
        ),
    }),
});

export type Service = z.infer<typeof serviceSchema>;

export const journeyPatternSectionSchema = z.object({
    JourneyPatternTimingLink: z
        .object({
            "@_id": z.string(),
            From: z
                .object({
                    "@_SequenceNumber": z.coerce.number(),
                    Activity: z.string().optional(),
                    StopPointRef: z.string(),
                    TimingStatus: z.string().optional(),
                    WaitTime: z.string().optional(),
                })
                .optional(),
            To: z
                .object({
                    WaitTime: z.string().optional(),
                })
                .optional(),
            RunTime: z.string().optional(),
        })
        .array(),
});

export type TxcJourneyPatternSection = z.infer<typeof journeyPatternSectionSchema>;

export const vehicleTypeSchema = z.object({
    WheelChairAccessible: z.boolean().optional(),
    VehicleEquipment: z
        .object({
            WheelchairEquipment: z
                .object({
                    NumberOfWheelChairAreas: z.coerce.number(),
                })
                .optional(),
        })
        .optional(),
});

export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const vehicleJourneyTimingLinkSchema = z.object({
    JourneyPatternTimingLinkRef: z.string(),
    From: z
        .object({
            "@_SequenceNumber": z.coerce.number(),
            Activity: z.string().optional(),
            StopPointRef: z.string(),
            TimingStatus: z.string().optional(),
            WaitTime: z.string().optional(),
        })
        .optional(),
    To: z
        .object({
            WaitTime: z.string().optional(),
        })
        .optional(),
    RunTime: z.string().optional(),
});

export const vehicleJourneySchema = z.object({
    VehicleJourneyCode: z.string(),
    DepartureTime: z.string(),
    DestinationDisplay: z.string().optional(),
    Frequency: z
        .object({
            EndTime: z.string(),
            Interval: z
                .object({
                    ScheduledFrequency: z.string(),
                })
                .optional(),
        })
        .optional(),
    Operational: z
        .object({
            Block: z
                .object({
                    BlockNumber: z.coerce.string(),
                })
                .optional(),
            VehicleType: vehicleTypeSchema.optional(),
        })
        .optional(),
    OperatingProfile: operatingProfileSchema.optional(),
    ServiceRef: z.string(),
    LineRef: z.string(),
    JourneyPatternRef: z.string(),
    VehicleJourneyTimingLink: z.array(vehicleJourneyTimingLinkSchema).optional(),
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
        Routes: z.object({
            Route: z.array(routeSchema),
        }),
        JourneyPatternSections: z.object({
            JourneyPatternSection: z.array(journeyPatternSectionSchema),
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
