import { z } from "zod";
import { getDate } from "../dates";
import { makeFilteredArraySchema } from "../utils";

export const avlSchema = z.object({
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
    vehicle_name: z.string().nullish(),
    monitored: z.string().nullish(),
    load: z.number().nullish(),
    passenger_count: z.number().nullish(),
    odometer: z.number().nullish(),
    headway_deviation: z.number().nullish(),
    schedule_deviation: z.number().nullish(),
    vehicle_state: z.number().nullish(),
    next_stop_point_id: z.string().nullish(),
    next_stop_point_name: z.string().nullish(),
    previous_stop_point_id: z.string().nullish(),
    previous_stop_point_name: z.string().nullish(),
    origin_name: z.string().nullish(),
    destination_name: z.string().nullish(),
    vehicle_journey_ref: z.string().nullish(),
});

export type Avl = z.infer<typeof avlSchema>;

const vehicleActivitySchema = z.object({
    RecordedAtTime: z.string(),
    ValidUntilTime: z.string(),
    MonitoredVehicleJourney: z.object({
        LineRef: z.coerce.string().optional(),
        DirectionRef: z.coerce.string(),
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

export const siriSchemaTransformed = siriSchema.transform<Avl[]>((item) => {
    return item.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map<Avl>((vehicleActivity) => ({
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

export const tflVehicleLocationSchema = z.object({
    producerRef: z.string(),
    vehicleRef: z.string(),
    vehicleName: z.string().nullish(),
    operatorRef: z.string(),
    monitored: z.string().nullish(),
    longitude: z.number(),
    latitude: z.number(),
    recordedAtTime: z.string(),
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

export const tflVehicleLocationSchemaTransformed = tflVehicleLocationSchema.transform<Avl>((item) => {
    const recordedAtTime = item.recordedAtTime || getDate().toISOString();
    const validUntilTime = getDate().add(5, "minutes").toISOString();
    const originAimedDepartureTime = getDate()
        .startOf("day")
        .add(item.originAimedDepartureTime || 0, "seconds")
        .toISOString();

    const avl: Avl = {
        response_time_stamp: recordedAtTime,
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
