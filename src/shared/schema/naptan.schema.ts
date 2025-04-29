import { z } from "zod";

const selfClosingTag = z.literal("");
const emptyTag = selfClosingTag.transform(() => undefined);

const locationSchema = z.object({
    Translation: z
        .object({
            GridType: z.string().optional(),
            Easting: z.string(),
            Northing: z.string(),
            Longitude: z.string(),
            Latitude: z.string(),
        })
        .optional(),
});

const stopClassificationSchema = z.object({
    StopType: z.string(),
    OnStreet: z
        .object({
            Bus: z
                .object({
                    BusStopType: z.string().optional(),
                    TimingStatus: z.string().optional(),
                    MarkedPoint: z
                        .object({
                            DefaultWaitTime: z.string().optional(),
                            Bearing: z.object({
                                CompassPoint: z.string(),
                            }),
                        })
                        .optional(),
                    UnmarkedPoint: z
                        .object({
                            Bearing: z.object({
                                CompassPoint: z.string(),
                            }),
                        })
                        .optional(),
                })
                .optional(),
        })
        .optional(),
    OffStreet: z
        .object({
            BusAndCoach: z
                .object({
                    Bay: z
                        .object({
                            TimingStatus: z.string().optional(),
                        })
                        .or(emptyTag)
                        .optional(),
                    VariableBay: z
                        .object({
                            TimingStatus: z.string().optional(),
                        })
                        .or(emptyTag)
                        .optional(),
                })
                .optional(),
        })
        .optional(),
});

const stopPointStopAreasSchema = z.object({
    StopAreaRef: z
        .string()
        .transform((ref) => ref.toUpperCase())
        .array()
        .optional(),
});

const stopPointSchema = z.object({
    AtcoCode: z.string().toUpperCase(),
    NaptanCode: z.string().optional(),
    PlateCode: z.string().optional(),
    CleardownCode: z.string().optional(),
    Descriptor: z.object({
        CommonName: z.string().optional(),
        ShortCommonName: z.string().optional(),
        Landmark: z.string().optional(),
        Street: z.string().optional(),
        Crossing: z.string().optional(),
        Indicator: z.string().optional(),
    }),
    Place: z.object({
        NptgLocalityRef: z.string(),
        LocalityName: z.string().optional(),
        Suburb: z.string().optional(),
        Town: z.string().optional(),
        LocalityCentre: z.string().optional(),
        Location: locationSchema,
    }),
    StopClassification: stopClassificationSchema,
    StopAreas: stopPointStopAreasSchema.optional(),
    AdministrativeAreaRef: z.string(),
    StopFurtherDetails: z
        .object({
            Notes: z.string().optional(),
        })
        .optional(),
});

const stopAreaSchema = z.object({
    StopAreaCode: z.string().transform((ref) => ref.toUpperCase()),
    Name: z.string(),
    AdministrativeAreaRef: z.string(),
    StopAreaType: z.string(),
    Location: locationSchema,
});

export const naptanSchema = z.object({
    NaPTAN: z.object({
        StopPoints: z.object({
            StopPoint: z.array(stopPointSchema),
        }),
        StopAreas: z
            .object({
                StopArea: z.array(stopAreaSchema),
            })
            .optional(),
    }),
});

export type Naptan = z.infer<typeof naptanSchema>;
