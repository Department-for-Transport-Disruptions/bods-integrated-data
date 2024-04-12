import { z } from "zod";

const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string(),
    ValidUntilTime: z.string(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.string().optional(),
        DirectionRef: z.string(),
        FramedVehicleJourneyRef: z
            .object({
                DataFrameRef: z.string(),
                DatedVehicleJourneyRef: z.string(),
            })
            .optional(),
        PublishedLineName: z.string().optional(),
        Occupancy: z.string().optional(),
        OperatorRef: z.string(),
        OriginRef: z.string().optional(),
        OriginAimedDepartureTime: z.string().optional(),
        DestinationRef: z.string().optional(),
        VehicleLocation: z.object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        }),
        Bearing: z.string().optional(),
        BlockRef: z.string().optional(),
        VehicleRef: z.string(),
    }),
});

export const siriSchema = z.object({
    ServiceDelivery: z.object({
        ResponseTimestamp: z.string(),
        ProducerRef: z.string(),
        VehicleMonitoringDelivery: z.object({
            ResponseTimestamp: z.string(),
            ValidUntil: z.string().optional(),
            RequestMessageRef: z.string().uuid().optional(),
            VehicleActivity: vehicleActivitySchema.array(),
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
        direction_ref: vehicleActivity.MonitoredVehicleJourney.DirectionRef,
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
    responseTimeStamp: z.string(),
    producerRef: z.string(),
    recordedAtTime: z.string(),
    validUntilTime: z.string(),
    lineRef: z.string().nullish(),
    directionRef: z.string(),
    occupancy: z.string().nullish(),
    operatorRef: z.string(),
    dataFrameRef: z.string().nullish(),
    datedVehicleJourneyRef: z.string().nullish(),
    vehicleRef: z.string(),
    dataSource: z.string().nullish(),
    longitude: z.number(),
    latitude: z.number(),
    bearing: z.string().nullish(),
    delay: z.string().nullish(),
    isCompleteStopSequence: z.boolean().nullish(),
    publishedLineName: z.string().nullish(),
    originRef: z.string().nullish(),
    originAimedDepartureTime: z.string().nullish(),
    destinationRef: z.string().nullish(),
    blockRef: z.string().nullish(),
});

export type Avl = z.infer<typeof avlSchema>;
