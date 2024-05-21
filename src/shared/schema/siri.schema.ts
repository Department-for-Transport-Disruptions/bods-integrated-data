import { z } from "zod";
import { makeFilteredArraySchema } from "../utils";

const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string(),
    ValidUntilTime: z.string(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.coerce.string().optional(),
        DirectionRef: z.coerce.string().optional(),
        FramedVehicleJourneyRef: z
            .object({
                DataFrameRef: z.coerce.string(),
                DatedVehicleJourneyRef: z.coerce.string(),
            })
            .optional(),
        PublishedLineName: z.coerce.string().optional(),
        Occupancy: z.coerce.string().optional(),
        OperatorRef: z.coerce.string(),
        OriginRef: z.coerce.string().optional(),
        OriginAimedDepartureTime: z.coerce.string().optional(),
        DestinationRef: z.coerce.string().optional(),
        VehicleLocation: z.object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        }),
        Bearing: z.coerce.string().optional(),
        BlockRef: z.coerce.string().optional(),
        VehicleRef: z.coerce.string(),
    }),
});

export const siriSchema = z.object({
    ServiceDelivery: z.object({
        ResponseTimestamp: z.string(),
        ProducerRef: z.coerce.string(),
        VehicleMonitoringDelivery: z.object({
            ResponseTimestamp: z.string(),
            ValidUntil: z.string().optional(),
            RequestMessageRef: z.string().uuid().optional(),
            VehicleActivity: makeFilteredArraySchema(vehicleActivitySchema),
        }),
    }),
});

export const siriSchemaTransformed = siriSchema.transform((item) => {
    return item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map((vehicleActivity) => ({
        response_time_stamp: item.ServiceDelivery.ResponseTimestamp,
        producer_ref: item.ServiceDelivery.ProducerRef,
        recorded_at_time: vehicleActivity.RecordedAtTime,
        valid_until_time: vehicleActivity.ValidUntilTime,
        line_ref: vehicleActivity.MonitoredVehicleJourney.LineRef ?? null,
        direction_ref: vehicleActivity.MonitoredVehicleJourney.DirectionRef ?? null,
        occupancy: vehicleActivity.MonitoredVehicleJourney.Occupancy ?? null,
        operator_ref: vehicleActivity.MonitoredVehicleJourney.OperatorRef,
        data_frame_ref: vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DataFrameRef ?? null,
        dated_vehicle_journey_ref:
            vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? null,
        vehicle_ref: vehicleActivity.MonitoredVehicleJourney.VehicleRef,
        longitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Longitude,
        latitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Latitude,
        bearing: vehicleActivity.MonitoredVehicleJourney.Bearing ?? null,
        published_line_name: vehicleActivity.MonitoredVehicleJourney.PublishedLineName ?? null,
        origin_ref: vehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
        origin_aimed_departure_time: vehicleActivity.MonitoredVehicleJourney.OriginAimedDepartureTime ?? null,
        destination_ref: vehicleActivity.MonitoredVehicleJourney.DestinationRef ?? null,
        block_ref: vehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
    }));
});

export type VehicleActivity = z.infer<typeof siriSchemaTransformed>;

export const avlSchema = z.object({
    id: z.number(),
    response_time_stamp: z.string(),
    producer_ref: z.string(),
    recorded_at_time: z.string(),
    valid_until_time: z.string(),
    line_ref: z.string().nullish(),
    direction_ref: z.string(),
    occupancy: z.string().nullish(),
    operator_ref: z.string(),
    data_frame_ref: z.string().nullish(),
    dated_vehicle_journey_ref: z.string().nullish(),
    vehicle_ref: z.string(),
    longitude: z.number(),
    latitude: z.number(),
    bearing: z.string().nullish(),
    published_line_name: z.string().nullish(),
    origin_ref: z.string().nullish(),
    origin_aimed_departure_time: z.string().nullish(),
    destination_ref: z.string().nullish(),
    block_ref: z.string().nullish(),
});

export type Avl = z.infer<typeof avlSchema>;
