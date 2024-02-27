import { z } from "zod";

const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string(),
    ValidUntilTime: z.string(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.string(),
        DirectionRef: z.string(),
        OperatorRef: z.string(),
        FramedVehicleJourneyRef: z.object({
            DataFrameRef: z.string(),
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
        IsCompleteStopSequence: z.boolean(),
        PublishedLineName: z.string().optional(),
        OriginRef: z.string().optional(),
        DestinationRef: z.string().optional(),
        BlockRef: z.string().optional(),
    }),
});

export const siriSchema = z
    .object({
        ServiceDelivery: z.object({
            ResponseTimestamp: z.string(),
            ProducerRef: z.string(),
            VehicleMonitoringDelivery: z.object({
                ResponseTimestamp: z.string(),
                VehicleActivity: vehicleActivitySchema,
            }),
        }),
    })
    .transform((item) => {
        return {
            responseTimeStamp: item.ServiceDelivery.ResponseTimestamp,
            producerRef: item.ServiceDelivery.ProducerRef,
            recordedAtTime: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.RecordedAtTime,
            validUntilTime: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.ValidUntilTime,
            lineRef: item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.LineRef,
            directionRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.DirectionRef,
            operatorRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.OperatorRef,
            datedVehicleJourneyRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney
                    .FramedVehicleJourneyRef.DatedVehicleJourneyRef,
            vehicleRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.VehicleRef,
            dataSource:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.DataSource,
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
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney
                    .PublishedLineName ?? null,
            originRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.OriginRef ??
                null,
            destinationRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.DestinationRef ??
                null,
            blockRef:
                item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
        };
    });

export type SiriSchema = z.infer<typeof siriSchema>;
