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
        OperatorRef: z.string(),
        OriginRef: z.string().optional(),
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
        responseTimeStamp: item.ServiceDelivery.ResponseTimestamp,
        producerRef: item.ServiceDelivery.ProducerRef,
        recordedAtTime: vehicleActivity.RecordedAtTime,
        validUntilTime: vehicleActivity.ValidUntilTime,
        lineRef: vehicleActivity.MonitoredVehicleJourney.LineRef ?? null,
        directionRef: vehicleActivity.MonitoredVehicleJourney.DirectionRef,
        operatorRef: vehicleActivity.MonitoredVehicleJourney.OperatorRef,
        dataFrameRef: vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DataFrameRef ?? null,
        datedVehicleJourneyRef:
            vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? null,
        vehicleRef: vehicleActivity.MonitoredVehicleJourney.VehicleRef,
        longitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Longitude,
        latitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Latitude,
        bearing: vehicleActivity.MonitoredVehicleJourney.Bearing ?? null,
        publishedLineName: vehicleActivity.MonitoredVehicleJourney.PublishedLineName ?? null,
        originRef: vehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
        destinationRef: vehicleActivity.MonitoredVehicleJourney.DestinationRef ?? null,
        blockRef: vehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
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
    destinationRef: z.string().nullish(),
    blockRef: z.string().nullish(),
});

export type Avl = z.infer<typeof avlSchema>;
