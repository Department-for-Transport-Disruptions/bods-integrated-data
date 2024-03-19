import { z } from "zod";
import { transformedBankHolidayOperationSchema } from "./dates.schema";
import { getDate, getDateRange } from "../dates";
import { txcSelfClosingProperty } from "../utils";

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
    .transform((range) =>
        getDateRange(getDate(range.StartDate), getDate(range.EndDate)).map((date) => date.format("YYYYMMDD")),
    );

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
                NotSaturday: txcSelfClosingProperty.optional(),
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
                    DateRange: dateRange.array(),
                })
                .optional(),
            DaysOfNonOperation: z
                .object({
                    DateRange: dateRange.array(),
                })
                .optional(),
        })
        .optional(),
    BankHolidayOperation: z
        .object({
            DaysOfOperation: transformedBankHolidayOperationSchema.optional(),
            DaysOfNonOperation: transformedBankHolidayOperationSchema.optional(),
        })
        .optional(),
});

export type OperatingProfile = z.infer<typeof operatingProfileSchema>;

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
            Operator: operatorSchema.array(),
        }),
        Services: z.object({
            Service: serviceSchema.array(),
        }),
        VehicleJourneys: z.object({
            VehicleJourney: vehicleJourneySchema.array(),
        }),
        StopPoints: z.object({
            AnnotatedStopPointRef: stopSchema.array(),
        }),
    }),
});
