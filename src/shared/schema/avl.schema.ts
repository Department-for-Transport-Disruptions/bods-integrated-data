import { z } from "zod";
import { NewAvl, NewAvlOnwardCall } from "../database";
import { getDate } from "../dates";
import { makeFilteredArraySchema, notEmpty, txcEmptyProperty, txcSelfClosingProperty } from "../utils";

const onwardCallSchema = z
    .object({
        StopPointRef: z.coerce.string().nullish(),
        AimedArrivalTime: z.coerce.string().nullish(),
        ExpectedArrivalTime: z.coerce.string().nullish(),
        AimedDepartureTime: z.coerce.string().nullish(),
        ExpectedDepartureTime: z.coerce.string().nullish(),
    })
    .or(txcSelfClosingProperty)
    .optional();

const extensionsSchema = z
    .object({
        VehicleJourney: z
            .object({
                Operational: z
                    .object({
                        TicketMachine: z
                            .object({
                                TicketMachineServiceCode: z.coerce.string().nullish(),
                                JourneyCode: z.coerce.string().nullish(),
                            })
                            .or(txcEmptyProperty)
                            .optional(),
                    })
                    .or(txcEmptyProperty)
                    .optional(),
                VehicleUniqueId: z.coerce.string().nullish(),
            })
            .or(txcEmptyProperty)
            .optional(),
    })
    .or(txcEmptyProperty)
    .optional();

const directionMap: Record<string, string> = {
    in: "inbound",
    out: "outbound",
};

export const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string().min(1),
    ItemIdentifier: z.string().nullish(),
    ValidUntilTime: z.string().min(1),
    VehicleMonitoringRef: z.coerce.string().nullish(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.coerce.string().nullish(),
        DirectionRef: z.coerce
            .string()
            .transform((direction) => directionMap[direction.toLowerCase()] ?? direction.toLowerCase()),
        FramedVehicleJourneyRef: z
            .object({
                DataFrameRef: z.coerce.string().min(1),
                DatedVehicleJourneyRef: z.coerce.string().min(1),
            })
            .optional(),
        PublishedLineName: z.coerce.string().nullish(),
        OperatorRef: z.coerce.string().min(1),
        OriginRef: z.coerce.string().nullish(),
        OriginName: z.coerce.string().nullish(),
        DestinationRef: z.coerce.string().nullish(),
        DestinationName: z.coerce.string().nullish(),
        OriginAimedDepartureTime: z.coerce.string().nullish(),
        DestinationAimedArrivalTime: z.coerce.string().nullish(),
        Monitored: z.coerce.string().nullish(),
        VehicleLocation: z.object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        }),
        Bearing: z.coerce.string().nullish(),
        Occupancy: z.coerce.string().nullish(),
        BlockRef: z.coerce.string().nullish(),
        VehicleJourneyRef: z.coerce.string().nullish(),
        VehicleRef: z.coerce
            .string()
            .min(1)
            .transform((ref) => ref.replace(/\s/g, "")),
        OnwardCalls: z
            .object({
                OnwardCall: makeFilteredArraySchema("SiriVmOnwardCallsSchema", onwardCallSchema),
            })
            .or(txcEmptyProperty)
            .optional(),
    }),
    Extensions: extensionsSchema,
});

export type SiriVehicleActivity = z.infer<typeof vehicleActivitySchema>;

export const siriSchema = z.object({
    ServiceDelivery: z.object({
        ResponseTimestamp: z.string(),
        ItemIdentifier: z.string().optional(),
        ProducerRef: z.coerce.string(),
        VehicleMonitoringDelivery: z.object({
            ResponseTimestamp: z.string(),
            RequestMessageRef: z.string().uuid().optional(),
            ValidUntil: z.string().optional(),
            VehicleActivity: makeFilteredArraySchema("SiriVmVehicleActivitySchema", vehicleActivitySchema),
        }),
    }),
});

export type SiriVM = z.infer<typeof siriSchema>;

export const siriSchemaTransformed = siriSchema.transform((item) => {
    return item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map((vehicleActivity) => {
        let onwardCalls: Omit<NewAvlOnwardCall, "avl_id">[] = [];

        if (vehicleActivity.MonitoredVehicleJourney.OnwardCalls) {
            onwardCalls = vehicleActivity.MonitoredVehicleJourney.OnwardCalls.OnwardCall.map((onwardCall) => {
                if (onwardCall) {
                    return {
                        stop_point_ref: onwardCall.StopPointRef ?? null,
                        aimed_arrival_time: onwardCall.AimedArrivalTime ?? null,
                        expected_arrival_time: onwardCall.ExpectedArrivalTime ?? null,
                        aimed_departure_time: onwardCall.AimedDepartureTime ?? null,
                        expected_departure_time: onwardCall.ExpectedDepartureTime ?? null,
                    };
                }
            }).filter(notEmpty);
        }

        return {
            response_time_stamp: item.ServiceDelivery.ResponseTimestamp,
            producer_ref: item.ServiceDelivery.ProducerRef,
            recorded_at_time: vehicleActivity.RecordedAtTime,
            item_id: vehicleActivity.ItemIdentifier,
            valid_until_time: vehicleActivity.ValidUntilTime,
            vehicle_monitoring_ref: vehicleActivity.VehicleMonitoringRef ?? null,
            line_ref: vehicleActivity.MonitoredVehicleJourney.LineRef ?? null,
            direction_ref: vehicleActivity.MonitoredVehicleJourney.DirectionRef ?? null,
            occupancy: vehicleActivity.MonitoredVehicleJourney.Occupancy ?? null,
            operator_ref: vehicleActivity.MonitoredVehicleJourney.OperatorRef,
            data_frame_ref: vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DataFrameRef ?? null,
            dated_vehicle_journey_ref:
                vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? null,

            longitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Longitude,
            latitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Latitude,
            bearing: vehicleActivity.MonitoredVehicleJourney.Bearing ?? null,
            monitored: vehicleActivity.MonitoredVehicleJourney.Monitored ?? null,
            published_line_name: vehicleActivity.MonitoredVehicleJourney.PublishedLineName ?? null,
            origin_ref: vehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
            origin_name: vehicleActivity.MonitoredVehicleJourney.OriginName ?? null,
            origin_aimed_departure_time: vehicleActivity.MonitoredVehicleJourney.OriginAimedDepartureTime ?? null,
            destination_ref: vehicleActivity.MonitoredVehicleJourney.DestinationRef ?? null,
            destination_name: vehicleActivity.MonitoredVehicleJourney.DestinationName ?? null,
            destination_aimed_arrival_time: vehicleActivity.MonitoredVehicleJourney.DestinationAimedArrivalTime ?? null,
            block_ref: vehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
            vehicle_ref: vehicleActivity.MonitoredVehicleJourney.VehicleRef,
            vehicle_journey_ref: vehicleActivity.MonitoredVehicleJourney.VehicleJourneyRef ?? null,
            ticket_machine_service_code:
                vehicleActivity.Extensions?.VehicleJourney?.Operational?.TicketMachine?.TicketMachineServiceCode ??
                null,
            journey_code: vehicleActivity.Extensions?.VehicleJourney?.Operational?.TicketMachine?.JourneyCode ?? null,
            vehicle_unique_id: vehicleActivity.Extensions?.VehicleJourney?.VehicleUniqueId ?? null,
            has_onward_calls: !!vehicleActivity.MonitoredVehicleJourney.OnwardCalls,
            onward_calls: onwardCalls && onwardCalls.length > 0 ? onwardCalls : null,
        };
    });
});

export const siriBodsSchemaTransformed = siriSchema.transform<NewAvl[]>((item) => {
    return item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map<NewAvl>((vehicleActivity) => ({
        response_time_stamp: item.ServiceDelivery.ResponseTimestamp,
        item_id: item.ServiceDelivery.ItemIdentifier ?? null,
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

export type SiriSchemaTransformed = z.infer<typeof siriSchemaTransformed>;

export const tflVehicleLocationSchema = z.object({
    producerRef: z.string(),
    vehicleRef: z.string(),
    vehicleName: z.string().nullish(),
    operatorRef: z.string(),
    monitored: z.string().nullish(),
    longitude: z.number(),
    latitude: z.number(),
    recordedAtTime: z.string(),
    item_id: z.string().nullish(),
    bearing: z.number().nullish(),
    load: z.number().nullish(),
    passengerCount: z.number().nullish(),
    odometer: z.number().nullish(),
    headwayDeviation: z.number().nullish(),
    scheduleDeviation: z.number().nullish(),
    vehicleState: z.number().nullish(),
    nextStopPointId: z.string().nullish(),
    nextStopPointName: z.string().nullish(),
    previousStopPointId: z.string().nullish(),
    previousStopPointName: z.string().nullish(),
    lineRef: z.string().nullish(),
    publishedLineName: z.string().nullish(),
    directionRef: z.number(),
    originName: z.string().nullish(),
    originRef: z.string().nullish(),
    originAimedDepartureTime: z.number().nullish(),
    destinationName: z.string().nullish(),
    destinationRef: z.string().nullish(),
    vehicleJourneyRef: z.string().nullish(),
});

export type TflVehicleLocation = z.infer<typeof tflVehicleLocationSchema>;

export const tflVehicleLocationSchemaTransformed = tflVehicleLocationSchema.transform<NewAvl>((item) => {
    const recordedAtTime = item.recordedAtTime || getDate().toISOString();
    const validUntilTime = getDate().add(5, "minutes").toISOString();
    const originAimedDepartureTime = getDate()
        .startOf("day")
        .add(item.originAimedDepartureTime || 0, "seconds")
        .toISOString();

    const avl: NewAvl = {
        response_time_stamp: recordedAtTime,
        item_id: item.item_id,
        valid_until_time: validUntilTime,
        producer_ref: item.producerRef,
        vehicle_ref: item.vehicleRef,
        vehicle_name: item.vehicleName,
        operator_ref: item.operatorRef,
        monitored: item.monitored,
        longitude: item.longitude,
        latitude: item.latitude,
        recorded_at_time: recordedAtTime,
        bearing: typeof item.bearing === "number" ? item.bearing.toString() : item.bearing,
        load: item.load,
        passenger_count: item.passengerCount,
        odometer: item.odometer,
        headway_deviation: item.headwayDeviation,
        schedule_deviation: item.scheduleDeviation,
        vehicle_state: item.vehicleState,
        next_stop_point_id: item.nextStopPointId,
        next_stop_point_name: item.nextStopPointName,
        previous_stop_point_id: item.previousStopPointId,
        previous_stop_point_name: item.previousStopPointName,
        line_ref: item.lineRef,
        published_line_name: item.publishedLineName,
        direction_ref: item.directionRef.toString(),
        origin_name: item.originName,
        origin_ref: item.originRef,
        origin_aimed_departure_time: originAimedDepartureTime,
        destination_name: item.destinationName,
        destination_ref: item.destinationRef,
        vehicle_journey_ref: item.vehicleJourneyRef,
    };

    return avl;
});
