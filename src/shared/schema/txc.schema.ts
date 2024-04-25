import { z } from "zod";
import { DEFAULT_DATE_FORMAT, transformedBankHolidayOperationSchema } from "./dates.schema";
import { getDate, getDateRange } from "../dates";
import { txcEmptyProperty, txcSelfClosingProperty } from "../utils";

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

const dateRange = z
    .object({
        StartDate: z.string(),
        EndDate: z.string(),
    })
    .transform((range) => getDateRange(getDate(range.StartDate), getDate(range.EndDate)));

const formattedDateRange = dateRange.transform((dates) => dates.map((date) => date.format(DEFAULT_DATE_FORMAT)));

const servicedOperationDayTypeSchema = z.object({
    WorkingDays: z
        .object({
            ServicedOrganisationRef: z.string().array(),
        })
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
            DaysOfOperation: transformedBankHolidayOperationSchema.or(txcEmptyProperty).optional(),
            DaysOfNonOperation: transformedBankHolidayOperationSchema.or(txcEmptyProperty).optional(),
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
        Location: locationSchema.array(),
    }),
});

const routeLinkSchema = z.object({
    Track: trackSchema.array().optional(),
});

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
    Mode: z.string().default("bus"),
    RegisteredOperatorRef: z.string(),
    StandardService: z.object({
        JourneyPattern: z
            .object({
                "@_id": z.string(),
                DestinationDisplay: z.string().optional(),
                RouteRef: z.string().optional(),
                JourneyPatternSectionRefs: z.string().array(),
            })
            .array(),
    }),
});

export type Service = z.infer<typeof serviceSchema>;

// Abstract schema for From and To within AbstractTimingLink
const abstractStopUsageSchema = z.object({
    Activity: z.string().optional(),
    StopPointRef: z.string().optional(),
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
    WheelChairAccessible: z.boolean().optional(),
    VehicleEquipment: z
        .object({
            WheelchairEquipment: z
                .object({
                    NumberOfWheelChairAreas: z.coerce.number(),
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
            TicketMachine: z
                .object({
                    JourneyCode: z.string().optional(),
                })
                .optional(),
            VehicleType: vehicleTypeSchema.optional(),
        })
        .or(txcEmptyProperty)
        .optional(),
    OperatingProfile: operatingProfileSchema.optional(),
    ServiceRef: z.string(),
    LineRef: z.string(),
    JourneyPatternRef: z.string(),
    VehicleJourneyTimingLink: z.array(vehicleJourneyTimingLinkSchema).optional(),
});

export type VehicleJourney = z.infer<typeof vehicleJourneySchema>;

export const stopPointSchema = z.object({
    AtcoCode: z.string(),
    Descriptor: z.object({
        CommonName: z.string(),
    }),
    Place: z.object({
        Location: locationSchema.optional(),
    }),
});

export type TxcStopPoint = z.infer<typeof stopPointSchema>;

export const annotatedStopPointRefSchema = z.object({
    StopPointRef: z.coerce.string(),
    CommonName: z.string(),
    Location: locationSchema.optional(),
});

export type TxcAnnotatedStopPointRef = z.infer<typeof annotatedStopPointRefSchema>;

export const servicedOrganisationSchema = z.object({
    OrganisationCode: z.string().optional(),
    WorkingDays: z
        .object({
            DateRange: dateRange.array(),
        })
        .optional(),
    Holidays: z
        .object({
            DateRange: dateRange.array(),
        })
        .optional(),
});

export type ServicedOrganisation = z.infer<typeof servicedOrganisationSchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: operatorSchema.array(),
        }),
        RouteSections: z.object({
            RouteSection: routeSectionSchema.array(),
        }),
        Routes: z.object({
            Route: routeSchema.array(),
        }),
        JourneyPatternSections: z.object({
            JourneyPatternSection: z.array(journeyPatternSectionSchema),
        }),
        ServicedOrganisations: z
            .object({
                ServicedOrganisation: servicedOrganisationSchema.array().optional(),
            })
            .optional(),
        Services: z.object({
            Service: serviceSchema.array(),
        }),
        VehicleJourneys: z
            .object({
                VehicleJourney: vehicleJourneySchema.array(),
            })
            .or(txcEmptyProperty),
        StopPoints: z.object({
            AnnotatedStopPointRef: annotatedStopPointRefSchema.array().optional(),
            StopPoint: stopPointSchema.array().optional(),
        }),
    }),
});
