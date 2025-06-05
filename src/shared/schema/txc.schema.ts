import { ZodSchema, z } from "zod";
import { txcEmptyProperty, txcSelfClosingProperty } from "../utils";
import { bankHolidayOperationSchema, baseDateRange, dateRange, formattedDateRange } from "./dates.schema";

export const operatorSchema = z.object({
    NationalOperatorCode: z.string().optional(),
    OperatorCode: z.string().optional(),
    OperatorShortName: z.string(),
    "@_id": z.string(),
});

export type Operator = z.infer<typeof operatorSchema>;

export const operatingPeriodSchema = z.object({
    StartDate: z.string(),
    EndDate: z.string().optional(),
});

export type OperatingPeriod = z.infer<typeof operatingPeriodSchema>;

const servicedOperationDayTypeSchema = z.object({
    WorkingDays: z
        .object({
            ServicedOrganisationRef: z.string().array(),
        })
        .array()
        .optional(),
    Holidays: z
        .object({
            ServicedOrganisationRef: z.string().array(),
        })
        .optional(),
});

export const operatingProfileSchema = z.object({
    RegularDayType: z.object({
        DaysOfWeek: z
            .object({
                Monday: txcSelfClosingProperty.optional(),
                Tuesday: txcSelfClosingProperty.optional(),
                Wednesday: txcSelfClosingProperty.optional(),
                Thursday: txcSelfClosingProperty.optional(),
                Friday: txcSelfClosingProperty.optional(),
                Saturday: txcSelfClosingProperty.optional(),
                Sunday: txcSelfClosingProperty.optional(),
                MondayToFriday: txcSelfClosingProperty.optional(),
                MondayToSaturday: txcSelfClosingProperty.optional(),
                MondayToSunday: txcSelfClosingProperty.optional(),
                NotMonday: txcSelfClosingProperty.optional(),
                NotTuesday: txcSelfClosingProperty.optional(),
                NotWednesday: txcSelfClosingProperty.optional(),
                NotThursday: txcSelfClosingProperty.optional(),
                NotFriday: txcSelfClosingProperty.optional(),
                NotSaturday: txcSelfClosingProperty.optional(),
                NotSunday: txcSelfClosingProperty.optional(),
                Weekend: txcSelfClosingProperty.optional(),
            })
            .or(z.literal(""))
            .optional(),
        HolidaysOnly: txcSelfClosingProperty.optional(),
    }),
    SpecialDaysOperation: z
        .object({
            DaysOfOperation: z
                .object({
                    DateRange: formattedDateRange.array(),
                })
                .or(txcEmptyProperty)
                .optional(),
            DaysOfNonOperation: z
                .object({
                    DateRange: formattedDateRange.array(),
                })
                .or(txcEmptyProperty)
                .optional(),
        })
        .or(txcEmptyProperty)
        .optional(),
    BankHolidayOperation: z
        .object({
            DaysOfOperation: bankHolidayOperationSchema.or(txcEmptyProperty).optional(),
            DaysOfNonOperation: bankHolidayOperationSchema.or(txcEmptyProperty).optional(),
        })
        .optional(),
    ServicedOrganisationDayType: z
        .object({
            DaysOfOperation: servicedOperationDayTypeSchema.or(txcEmptyProperty).optional(),
            DaysOfNonOperation: servicedOperationDayTypeSchema.or(txcEmptyProperty).optional(),
        })
        .or(txcEmptyProperty)
        .optional(),
});

export const operatingProfileSchemaWithDateRange = operatingProfileSchema.extend({
    SpecialDaysOperation: z
        .object({
            DaysOfOperation: z
                .object({
                    DateRange: baseDateRange.array(),
                })
                .or(txcEmptyProperty)
                .optional(),
            DaysOfNonOperation: z
                .object({
                    DateRange: baseDateRange.array(),
                })
                .or(txcEmptyProperty)
                .optional(),
        })
        .or(txcEmptyProperty)
        .optional(),
});

export type OperatingProfile = z.infer<typeof operatingProfileSchema>;
export type OperatingProfileWithDateRange = z.infer<typeof operatingProfileSchemaWithDateRange>;

const locationSchema = z.object({
    Translation: z
        .object({
            Latitude: z.coerce.number().optional(),
            Longitude: z.coerce.number().optional(),
            Easting: z.string().optional(),
            Northing: z.string().optional(),
        })
        .optional(),
    Latitude: z.coerce.number().optional(),
    Longitude: z.coerce.number().optional(),
    Easting: z.string().optional(),
    Northing: z.string().optional(),
});

export type StopPointLocation = z.infer<typeof locationSchema>;

const trackSchema = z.object({
    Mapping: z.object({
        Location: locationSchema.array(),
    }),
});

const routeLinkSchema = z.object({
    Track: trackSchema.array().optional(),
});

export type TxcRouteLink = z.infer<typeof routeLinkSchema>;

export const routeSectionSchema = z.object({
    "@_id": z.string(),
    RouteLink: routeLinkSchema.array(),
});

export type TxcRouteSection = z.infer<typeof routeSectionSchema>;

export const routeSchema = z.object({
    "@_id": z.string(),
    RouteSectionRef: z.string().array(),
});

export type TxcRoute = z.infer<typeof routeSchema>;

export const journeyPatternSchema = z.object({
    "@_id": z.string(),
    DestinationDisplay: z.string().optional(),
    RouteRef: z.string().optional(),
    JourneyPatternSectionRefs: z.string().array(),
    Direction: z.string().optional(),
});

export type JourneyPattern = z.infer<typeof journeyPatternSchema>;

export const serviceSchema = z.object({
    ServiceCode: z.string(),
    OperatingPeriod: operatingPeriodSchema,
    OperatingProfile: operatingProfileSchema.optional(),
    Lines: z.object({
        Line: z
            .object({
                "@_id": z.string(),
                LineName: z.string(),
            })
            .array(),
    }),
    Mode: z.string().optional(),
    RegisteredOperatorRef: z.string(),
    StandardService: z.object({
        JourneyPattern: journeyPatternSchema.array(),
    }),
});

export type Service = z.infer<typeof serviceSchema>;

// Abstract schema for From and To within AbstractTimingLink
const abstractStopUsageSchema = z.object({
    Activity: z.string().optional(),
    StopPointRef: z.string().toUpperCase().optional(),
    TimingStatus: z.string().optional(),
    WaitTime: z.string().optional(),
});

export type AbstractStopUsage = z.infer<typeof abstractStopUsageSchema>;

// Abstract schema for JourneyPatternTimingLink and VehicleJourneyTimingLink
const abstractTimingLinkSchema = z.object({
    "@_id": z.string().optional(),
    From: abstractStopUsageSchema.optional(),
    To: abstractStopUsageSchema.optional(),
    RunTime: z.string().optional(),
});

export type AbstractTimingLink = z.infer<typeof abstractTimingLinkSchema>;

export const journeyPatternSectionSchema = z.object({
    "@_id": z.string(),
    JourneyPatternTimingLink: abstractTimingLinkSchema.array(),
});

export type TxcJourneyPatternSection = z.infer<typeof journeyPatternSectionSchema>;

export const vehicleTypeSchema = z.object({
    WheelchairAccessible: z
        .string()
        .optional()
        .transform((value) => (value === "true" ? true : value === "false" ? false : undefined)),
    VehicleEquipment: z
        .object({
            WheelchairEquipment: z
                .object({
                    NumberOfWheelchairAreas: z.coerce.number(),
                })
                .optional(),
        })
        .or(txcEmptyProperty)
        .optional(),
});

export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const vehicleJourneyTimingLinkSchema = abstractTimingLinkSchema.extend({
    JourneyPatternTimingLinkRef: z.string(),
});

export const vehicleJourneySchema = z.object({
    "@_RevisionNumber": z.string().optional(),
    VehicleJourneyCode: z.string(),
    DepartureTime: z.string(),
    DepartureDayShift: z.preprocess((item) => (item === "1" || item === "+1" ? 1 : undefined), z.literal(1).optional()),
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
            TicketMachine: z
                .object({
                    TicketMachineServiceCode: z.coerce.string().nullish(),
                    JourneyCode: z.coerce.string().nullish(),
                })
                .or(txcEmptyProperty)
                .optional(),
            VehicleType: vehicleTypeSchema.optional(),
        })
        .or(txcEmptyProperty)
        .optional(),
    OperatingProfile: operatingProfileSchema.optional(),
    ServiceRef: z.string(),
    LineRef: z.string(),
    /**
     * JourneyPatternRef is not an optional property in the schema but there are a non-negligible
     * amount of files that omit it in favour of using VehicleJourneyRef.
     */
    JourneyPatternRef: z.string().optional(),
    VehicleJourneyRef: z.string().optional(),
    VehicleJourneyTimingLink: vehicleJourneyTimingLinkSchema.array().optional(),
});

export type VehicleJourney = z.infer<typeof vehicleJourneySchema>;

export const stopPointSchema = z.object({
    AtcoCode: z.string().toUpperCase(),
    Descriptor: z.object({
        CommonName: z.string(),
    }),
    Place: z.object({
        Location: locationSchema.optional(),
    }),
});

export type TxcStopPoint = z.infer<typeof stopPointSchema>;

export const annotatedStopPointRefSchema = z.object({
    StopPointRef: z.coerce.string().toUpperCase(),
    CommonName: z.string(),
    Location: locationSchema.optional(),
});

export type TxcAnnotatedStopPointRef = z.infer<typeof annotatedStopPointRefSchema>;

export const servicedOrganisationSchema = z.object({
    OrganisationCode: z.string().optional(),
    Name: z.string().optional(),
    WorkingDays: z
        .object({
            DateRange: dateRange.array(),
        })
        .array()
        .optional(),
    Holidays: z
        .object({
            DateRange: dateRange.array(),
        })
        .optional(),
});

export type ServicedOrganisation = z.infer<typeof servicedOrganisationSchema>;

const operatorsSchema = z.object({
    Operator: operatorSchema.array().optional(),
});

const routeSectionsSchema = z.object({
    RouteSection: routeSectionSchema.array().optional(),
});

const routesSchema = z.object({
    Route: routeSchema.array().optional(),
});

const journeyPatternSectionsSchema = z.object({
    JourneyPatternSection: journeyPatternSectionSchema.array().optional(),
});

export type JourneyPatternSections = z.infer<typeof journeyPatternSectionsSchema>;

const servicedOrganisationsSchema = z.object({
    ServicedOrganisation: servicedOrganisationSchema.array().optional(),
});

const servicesSchema = z.object({
    Service: serviceSchema.array().optional(),
});

const vehicleJourneysSchema = z.object({
    VehicleJourney: vehicleJourneySchema.array().optional(),
});

const stopPointsSchema = z.object({
    AnnotatedStopPointRef: annotatedStopPointRefSchema.array().optional(),
    StopPoint: stopPointSchema.array().optional(),
});

const castToObject = <T extends ZodSchema>(schema: T) => z.preprocess((val) => Object(val), schema);

export const txcSchema = z.object({
    TransXChange: z.object({
        "@_RevisionNumber": z.string().optional().default("0"),
        Operators: castToObject(operatorsSchema.optional()),
        RouteSections: castToObject(routeSectionsSchema.optional()),
        Routes: castToObject(routesSchema.optional()),
        JourneyPatternSections: castToObject(journeyPatternSectionsSchema.optional()),
        ServicedOrganisations: castToObject(servicedOrganisationsSchema.optional()),
        Services: castToObject(servicesSchema.optional()),
        VehicleJourneys: castToObject(vehicleJourneysSchema.optional()),
        StopPoints: castToObject(stopPointsSchema.optional()),
    }),
});

export type TxcSchema = z.infer<typeof txcSchema>;
