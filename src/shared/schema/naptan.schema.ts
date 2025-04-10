import { z } from "zod";
import { NewNaptanStop } from "../database";

const locationSchema = z.object({
    Translation: z.object({
        GridType: z.string().optional(),
        Easting: z.string(),
        Northing: z.string(),
        Longitude: z.string(),
        Latitude: z.string(),
    }),
});

const stopClassificationSchema = z.object({
    StopType: z.string(),
    OnStreet: z.object({
        Bus: z.object({
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
        }),
    }),
});

const stopPointStopAreasSchema = z.object({
    StopAreaRef: z
        .string()
        .transform((ref) => ref.toUpperCase())
        .optional(),
});

const stopPointSchema = z.object({
    CreationDateTime: z.string(),
    ModificationDateTime: z.string().optional(),
    Modification: z.string().optional(),
    RevisionNumber: z.string().optional(),
    Status: z.string().optional().default("active"),
    AtcoCode: z.string(),
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

const stopAreasSchema = z.object({
    StopAreaCode: z.string().transform((ref) => ref.toUpperCase()),
    Name: z.string(),
    AdministrativeAreaRef: z.string(),
    StopAreaType: z.string(),
    Location: locationSchema,
});

export const naptanSchema = z.object({
    NaPTAN: z.object({
        StopPoints: z.array(stopPointSchema),
        StopAreas: z.array(stopAreasSchema),
    }),
});

export const naptanSchemaTransformed = naptanSchema.transform((item) => {
    const stopPoints: NewNaptanStop[] = [];
    const stopAreas = [];

    if (item.NaPTAN.StopPoints.length > 0) {
        const transformedStopPoints = item.NaPTAN.StopPoints.map((stop) => {
            return {
                atco_code: stop.AtcoCode,
                naptan_code: stop.NaptanCode ?? null,
                plate_code: stop.PlateCode ?? null,
                cleardown_code: stop.CleardownCode ?? null,
                common_name: stop.Descriptor.CommonName ?? null,
                short_common_name: stop.Descriptor.ShortCommonName ?? null,
                landmark: stop.Descriptor.Landmark ?? null,
                street: stop.Descriptor.Street ?? null,
                crossing: stop.Descriptor.Crossing ?? null,
                indicator: stop.Descriptor.Indicator ?? null,
                bearing: stop.StopClassification.OnStreet.Bus.MarkedPoint?.Bearing.CompassPoint
                    ? stop.StopClassification.OnStreet.Bus.MarkedPoint.Bearing.CompassPoint
                    : stop.StopClassification.OnStreet.Bus.UnmarkedPoint?.Bearing.CompassPoint ?? null,
                nptg_locality_code: stop.Place.NptgLocalityRef,
                locality_name: stop.Place.LocalityName ?? null,
                town: stop.Place.Town ?? null,
                suburb: stop.Place.Suburb ?? null,
                locality_centre: stop.Place.LocalityCentre ?? null,
                grid_type: stop.Place.Location.Translation.GridType ?? null,
                easting: stop.Place.Location.Translation.Easting,
                northing: stop.Place.Location.Translation.Northing,
                longitude: stop.Place.Location.Translation.Longitude,
                latitude: stop.Place.Location.Translation.Latitude,
                stop_type: stop.StopClassification.StopType,
                bus_stop_type: stop.StopClassification.OnStreet.Bus.BusStopType,
                timing_status: stop.StopClassification.OnStreet.Bus.TimingStatus ?? null,
                default_wait_time: stop.StopClassification.OnStreet.Bus.MarkedPoint?.DefaultWaitTime ?? null,
                notes: stop.StopFurtherDetails?.Notes ?? null,
                administrative_area_code: stop.AdministrativeAreaRef,
                creation_date_time: stop.CreationDateTime ?? null,
                modification_date_time: stop.ModificationDateTime ?? null,
                revision_number: stop.RevisionNumber ?? null,
                modification: stop.Modification ?? null,
                status: stop.Status,
                stop_area_code: stop.StopAreas?.StopAreaRef ?? null,
            };
        });

        stopPoints.push(...transformedStopPoints);
    }

    if (item.NaPTAN.StopAreas.length > 0) {
        const transformedStopAreas = item.NaPTAN.StopAreas.map((stopArea) => {
            return {
                stop_area_code: stopArea.StopAreaCode,
                name: stopArea.Name,
                administrative_area_code: stopArea.AdministrativeAreaRef,
                stop_area_type: stopArea.StopAreaType,
                grid_type: stopArea.Location.Translation.GridType ?? null,
                easting: stopArea.Location.Translation.Easting,
                northing: stopArea.Location.Translation.Northing,
                longitude: stopArea.Location.Translation.Longitude,
                latitude: stopArea.Location.Translation.Latitude,
            };
        });

        stopAreas.push(...transformedStopAreas);
    }

    return { stopPoints, stopAreas };
});

export type Naptan = z.infer<typeof naptanSchema>;
