import { z } from "zod";

const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string(),
    ValidUntilTime: z.string(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.string().optional(),
        DirectionRef: z.string(),
        OperatorRef: z.string(),
        FramedVehicleJourneyRef: z
            .object({
                DataFrameRef: z.string(),
                DatedVehicleJourneyRef: z.string(),
            })
            .optional(),
        VehicleRef: z.string(),
        DataSource: z.string().optional(),
        VehicleLocation: z.object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        }),
        Bearing: z.string().optional(),
        Delay: z.string().optional(),
        IsCompleteStopSequence: z.boolean().optional(),
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
                VehicleActivity: vehicleActivitySchema.array(),
            }),
        }),
    })
    .transform((item) => {
        return item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map((vehicleActivity) => ({
            responseTimeStamp: item.ServiceDelivery.ResponseTimestamp,
            producerRef: item.ServiceDelivery.ProducerRef,
            recordedAtTime: vehicleActivity.RecordedAtTime,
            validUntilTime: vehicleActivity.ValidUntilTime,
            lineRef: vehicleActivity.MonitoredVehicleJourney.LineRef ?? null,
            directionRef: vehicleActivity.MonitoredVehicleJourney.DirectionRef,
            operatorRef: vehicleActivity.MonitoredVehicleJourney.OperatorRef,
            datedVehicleJourneyRef:
                vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? null,
            vehicleRef: vehicleActivity.MonitoredVehicleJourney.VehicleRef,
            dataSource: vehicleActivity.MonitoredVehicleJourney.DataSource ?? null,
            longitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Longitude,
            latitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Latitude,
            bearing: vehicleActivity.MonitoredVehicleJourney.Bearing ?? null,
            delay: vehicleActivity.MonitoredVehicleJourney.Delay ?? null,
            isCompleteStopSequence: vehicleActivity.MonitoredVehicleJourney.IsCompleteStopSequence ?? null,
            publishedLineName: vehicleActivity.MonitoredVehicleJourney.PublishedLineName ?? null,
            originRef: vehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
            destinationRef: vehicleActivity.MonitoredVehicleJourney.DestinationRef ?? null,
            blockRef: vehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
        }));
    });

export type VehicleActivity = z.infer<typeof siriSchema>;
