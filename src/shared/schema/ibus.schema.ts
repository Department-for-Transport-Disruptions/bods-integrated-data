import { z } from "zod";

enum BlockRunsOnDay {
    No = 0,
    Yes = 1,
}

enum TripDirection {
    Out = 1,
    Back = 2,
}

enum TripType {
    InService = 1,
    GarageRunOut = 2,
    GarageRunIn = 3,
    TurningManoeuvre = 4,
}

export const iBusArrayProperties = [
    "Block",
    "Block_CalendarDay",
    "Destination",
    "Garage",
    "Journey",
    "Journey_Drive_Time",
    "Journey_Wait_Time",
    "Line",
    "Operator",
    "Pattern",
    "Route_Geometry",
    "Stop_In_Pattern",
    "Stop_Point",
    "Vehicle",
];

export const tflVehicleSchema = z.object({
    Vehicle: z.array(
        z.object({
            "@_aVehicleId": z.number(),
            Registration_Number: z.string().max(20),
            Bonnet_No: z.string().max(10),
            Operator_Agency: z.string().max(128),
        }),
    ),
});

export type TflVehicleSchema = z.infer<typeof tflVehicleSchema>;

export const tflOperatorSchema = z.object({
    Operator: z.array(
        z.object({
            "@_aOperator_Code": z.string(),
            Operator_Name: z.string().max(128).nullable(),
            Operator_Agency: z.string().max(128),
        }),
    ),
});

export type TflOperatorSchema = z.infer<typeof tflOperatorSchema>;

export const tflGarageSchema = z.object({
    Garage: z.array(
        z.object({
            "@_aGarage_No": z.number(),
            "@_aOperator_Code": z.string().max(10),
            Garage_Code: z.string().max(10),
            Garage_Name: z.string().max(256),
        }),
    ),
});

export type TflGarageSchema = z.infer<typeof tflGarageSchema>;

export const tflBlockSchema = z.object({
    Block: z.array(
        z.object({
            "@_aBlock_Idx": z.number(),
            "@_aOperator_Code": z.string().max(10),
            Block_No: z.number(),
            Running_No: z.number(),
            Garage_No: z.number().nullable(),
        }),
    ),
});

export type TflBlockSchema = z.infer<typeof tflBlockSchema>;

export const tflBlockCalendarDaySchema = z.object({
    Block_CalendarDay: z.array(
        z.object({
            "@_aBlock_Idx": z.number(),
            "@_aCalendar_Day": z.string().date(),
            Block_Runs_On_Day: z.nativeEnum(BlockRunsOnDay),
        }),
    ),
});

export type TflBlockCalendarDaySchema = z.infer<typeof tflBlockCalendarDaySchema>;

export const tflStopPointSchema = z.object({
    Stop_Point: z.array(
        z.object({
            "@_aStop_Point_Idx": z.number(),
            Stop_Code_LBSL: z.string().max(15).nullable(),
            Stop_Name: z.string().max(15),
            Location_Easting: z.number().nullable(),
            Location_Northing: z.number().nullable(),
            Location_Longitude: z.number(),
            Location_Latitude: z.number(),
            Point_Letter: z.string().max(3).nullable(),
            NaPTAN_Code: z.string().max(15).nullable(),
            SMS_Code: z.string().max(15).nullable(),
            Stop_Area: z.string().max(12),
            Borough_Code: z.string().max(3).nullable(),
            Heading: z.number().nullable().nullable(),
            Stop_Type: z.string().max(256),
            Street_Name: z.string().max(256).nullable(),
            Post_Code: z.string().max(10).nullable(),
            Towards: z.string().max(128),
        }),
    ),
});

export type TflStopPointSchema = z.infer<typeof tflStopPointSchema>;

export const tflDestinationSchema = z.object({
    Destination: z.array(
        z.object({
            "@_aDestination_Idx": z.number(),
            Long_Destination_Name: z.string().max(40),
            Short_Destination_Name: z.string().max(15).nullable(),
        }),
    ),
});

export type TflDestinationSchema = z.infer<typeof tflDestinationSchema>;

export const tflRouteGeometrySchema = z.object({
    Route_Geometry: z.array(
        z.object({
            "@_aContract_Line_No": z.string(),
            "@_aLBSL_Run_No": z.number(),
            "@_aSequence_No": z.number(),
            Direction: z.nativeEnum(TripDirection),
            Location_Easting: z.number(),
            Location_Northing: z.number(),
            Location_Longitude: z.number(),
            Location_Latitude: z.number(),
        }),
    ),
});

export type TflRouteGeometrySchema = z.infer<typeof tflRouteGeometrySchema>;

export const tflLineSchema = z.object({
    Line: z.array(
        z.object({
            "@_aContract_Line_No": z.string().max(6),
            Service_Line_No: z.string().max(6),
            Logical_Line_No: z.number(),
        }),
    ),
});

export type TflLineSchema = z.infer<typeof tflLineSchema>;

export const tflPatternSchema = z.object({
    Pattern: z.array(
        z.object({
            "@_aPattern_Idx": z.number(),
            "@_aContract_Line_No": z.string(),
            Direction: z.nativeEnum(TripDirection),
            Type: z.nativeEnum(TripType),
        }),
    ),
});

export type TflPatternSchema = z.infer<typeof tflPatternSchema>;

export const tflStopInPatternSchema = z.object({
    Stop_In_Pattern: z.array(
        z.object({
            "@_aStop_In_Pattern_Idx": z.number(),
            "@_aPattern_Idx": z.number(),
            "@_aDestination_Idx": z.number(),
            "@_aStop_Point_Idx": z.number(),
            Sequence_No: z.number(),
            Timing_Point_Code: z.string().max(10),
        }),
    ),
});

export type TflStopInPatternSchema = z.infer<typeof tflStopInPatternSchema>;

export const tflJourneySchema = z.object({
    Journey: z.array(
        z.object({
            "@_aJourney_Idx": z.number(),
            "@_aPattern_Idx": z.number(),
            "@_aBlock_Idx": z.number(),
            Trip_No_LBSL: z.number(),
            Type: z.nativeEnum(TripType),
            Start_Time: z.number(),
        }),
    ),
});

export type TflJourneySchema = z.infer<typeof tflJourneySchema>;

export const tflJourneyWaitTimeSchema = z.object({
    Journey_Wait_Time: z.array(
        z.object({
            "@_aJourney_Idx": z.number(),
            "@_aStop_In_Pattern_Idx": z.number(),
            Wait_Time: z.number(),
        }),
    ),
});

export type TflJourneyWaitTimeSchema = z.infer<typeof tflJourneyWaitTimeSchema>;

export const tflJourneyDriveTimeSchema = z.object({
    Journey_Drive_Time: z.array(
        z.object({
            "@_aJourney_Idx": z.number(),
            "@_aStop_In_Pattern_From_Idx": z.number(),
            "@_aStop_In_Pattern_To_Idx": z.number(),
            Drive_Time: z.number(),
        }),
    ),
});

export type TflJourneyDriveTimeSchema = z.infer<typeof tflJourneyDriveTimeSchema>;

export const iBusSchema = z.object({
    "vh:Vehicle_Data": tflVehicleSchema.optional(),
    "op:Network_Data": tflOperatorSchema.optional(),
    "gar:Network_Data": tflGarageSchema.optional(),
    "bl:Schedule_Data": tflBlockSchema.optional(),
    "blcal:Schedule_Data": tflBlockCalendarDaySchema.optional(),
    "sp:Network_Data": tflStopPointSchema.optional(),
    "dst:Network_Data": tflDestinationSchema.optional(),
    "rg:Network_Data": tflRouteGeometrySchema.optional(),
    "In:Network_Data": tflLineSchema.optional(),
    "pt:Network_Data": tflPatternSchema.optional(),
    "sipt:Network_Data": tflStopInPatternSchema.optional(),
    "jou:Schedule_Data": tflJourneySchema.optional(),
    "jouwt:Schedule_Data": tflJourneyWaitTimeSchema.optional(),
    "joudt:Schedule_Data": tflJourneyDriveTimeSchema.optional(),
});
