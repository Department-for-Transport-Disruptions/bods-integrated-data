import { z } from "zod";

const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string().datetime(),
    ValidUntilTime: z.string().datetime(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.string(),
        DirectionRef: z.string(),
        OperatorRef: z.string(),
        FramedVehicleJourneyRef: z.object({
            DataFrameRef: z.string().optional(),
            DatedVehicleJourneyRef: z.string(),
        }),
        VehicleRef: z.string(),
        DataSource: z.string(),
        VehicleLocation: z.object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        }),
        Bearing: z.string(),
        Delay: z.string(),
        IsCompleteStopSequence: z.coerce.boolean(),
        PublishedLineName: z.string().optional(),
        OriginRef: z.string().optional(),
        DestinationRef: z.string().optional(),
        BlockRef: z.string().optional(),
    }),
});

export const siriSchema = z.object({
    ServiceDelivery: z.object({
        ResponseTimestamp: z.string().datetime(),
        ProducerRef: z.string(),
        VehicleMonitoringDelivery: z.object({
            ResponseTimestamp: z.string().datetime(),
            VehicleActivity: z.array(vehicleActivitySchema),
        }),
    }),
});

export const siriSchemaTransformed = siriSchema.transform((item) => {
    return {
        responseTimeStamp: item.ServiceDelivery.ResponseTimestamp,
        producerRef: item.ServiceDelivery.ProducerRef,
        recordedAtTime: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.RecordedAtTime,
        validUntilTime: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.ValidUntilTime,
        lineRef: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.LineRef,
        directionRef:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.DirectionRef,
        operatorRef: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.OperatorRef,
        datedVehicleJourneyRef:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney
                .FramedVehicleJourneyRef.DatedVehicleJourneyRef,
        vehicleRef: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.VehicleRef,
        dataSource: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.DataSource,
        longitude:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.VehicleLocation
                .Longitude,
        latitude:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.VehicleLocation
                .Latitude,
        bearing: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.Bearing,
        delay: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.Delay,
        isCompleteStopSequence:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney
                .IsCompleteStopSequence,
        publishedLineName:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.PublishedLineName ??
            null,
        originRef:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
        destinationRef:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.DestinationRef ??
            null,
        blockRef:
            item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
    };
});

export type TransformedSiriSchema = z.infer<typeof siriSchemaTransformed>;

export const avlSchema = z.object({
    id: z.number(),
    responseTimeStamp: z.string(),
    producerRef: z.string(),
    recordedAtTime: z.string(),
    validUntilTime: z.string(),
    lineRef: z.string(),
    directionRef: z.string(),
    operatorRef: z.string(),
    datedVehicleJourneyRef: z.string(),
    vehicleRef: z.string(),
    dataSource: z.string(),
    longitude: z.string(),
    latitude: z.string(),
    bearing: z.string(),
    delay: z.string(),
    isCompleteStopSequence: z.string(),
    publishedLineName: z.string().nullish(),
    originRef: z.string().nullish(),
    destinationRef: z.string().nullish(),
    blockRef: z.string().nullish(),
});

export type Avl = z.infer<typeof avlSchema>;
