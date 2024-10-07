import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAvlErrorDetails } from "../avl/utils";
import { putMetricData } from "../cloudwatch";
import { MAX_DECIMAL_PRECISION, avlOccupancyValues } from "../constants";
import { Avl, NewAvl, NewBodsAvl } from "../database";
import { getDate } from "../dates";
import { logger } from "../logger";
import {
    makeFilteredArraySchema,
    notEmpty,
    roundToDecimalPlaces,
    txcEmptyProperty,
    txcSelfClosingProperty,
} from "../utils";
import {
    NM_TOKEN_DISALLOWED_CHARS_REGEX,
    NM_TOKEN_REGEX,
    REQUEST_PARAM_MAX_LENGTH,
    SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX,
    createNmTokenOrNumberSiriValidation,
    createNmTokenSiriValidation,
    createPopulatedStringValidation,
} from "../validation";
import { AvlValidationError } from "./avl-validation-error.schema";
import { normalizedStringSchema } from "./misc.schema";

const onwardCallSchema = z
    .object({
        StopPointRef: z.coerce.string().regex(NM_TOKEN_REGEX).nullish(),
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
                DriverRef: z.coerce.string().nullish(),
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
    ItemIdentifier: createNmTokenSiriValidation("ItemIdentifier", false),
    ValidUntilTime: z.string().min(1),
    VehicleMonitoringRef: createNmTokenSiriValidation("VehicleMonitoringRef", false),
    MonitoredVehicleJourney: z.object({
        LineRef: createNmTokenSiriValidation("LineRef", false),
        DirectionRef: z.union([
            z
                .string()
                .regex(NM_TOKEN_REGEX, {
                    message: `DirectionRef must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
                })
                .transform((direction) => directionMap[direction.toLowerCase()] ?? direction.toLowerCase()),
            z.number(),
        ]),
        FramedVehicleJourneyRef: z
            .object({
                DataFrameRef: createNmTokenOrNumberSiriValidation("DataFrameRef"),
                DatedVehicleJourneyRef: createNmTokenOrNumberSiriValidation("DatedVehicleJourneyRef"),
            })
            .optional(),
        PublishedLineName: z.coerce.string().nullish(),
        OperatorRef: z.string().regex(NM_TOKEN_REGEX, {
            message: `OperatorRef must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
        }),
        OriginRef: createNmTokenSiriValidation("OriginRef", false),
        OriginName: createPopulatedStringValidation("OriginName").nullish(),
        DestinationRef: createNmTokenSiriValidation("DestinationRef", false),
        DestinationName: createPopulatedStringValidation("DestinationName").nullish(),
        OriginAimedDepartureTime: z.coerce.string().nullish(),
        DestinationAimedArrivalTime: z.coerce.string().nullish(),
        Monitored: z.coerce.string().nullish(),
        VehicleLocation: z.object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        }),
        Bearing: z.coerce.number().nullish(),
        Occupancy: z.enum(avlOccupancyValues).nullish(),
        BlockRef: createNmTokenSiriValidation("BlockRef", false),
        VehicleJourneyRef: createNmTokenSiriValidation("VehicleJourneyRef", false),
        VehicleRef: z.union([z.string().regex(NM_TOKEN_REGEX), z.number()]),
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

const makeFilteredVehicleActivityArraySchema = (namespace: string, errors?: AvlValidationError[]) =>
    z.preprocess((input) => {
        const result = z.any().array().parse(input);

        return result.filter((item, index) => {
            const parsedItem = vehicleActivitySchema
                .refine((activity) => getDate(activity.RecordedAtTime) <= getDate().add(1, "minute"), {
                    message: "RecordedAtTime in future",
                    path: ["RecordedAtTime"],
                })
                .safeParse(item);

            if (!parsedItem.success) {
                logger.warn("Error parsing item");
                logger.warn(parsedItem.error.format());

                errors?.push(
                    ...parsedItem.error.errors.map<AvlValidationError>((error) => {
                        const { name, message, level } = getAvlErrorDetails(error);
                        const nameWithPrefix = `Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity[${index}].${name}`;

                        return {
                            PK: "",
                            SK: randomUUID(),
                            details: message,
                            filename: "",
                            itemIdentifier: item?.ItemIdentifier,
                            level,
                            lineRef: item?.MonitoredVehicleJourney?.LineRef,
                            name: nameWithPrefix,
                            operatorRef: item?.MonitoredVehicleJourney?.OperatorRef,
                            recordedAtTime: item?.RecordedAtTime,
                            timeToExist: 0,
                            vehicleJourneyRef: item?.MonitoredVehicleJourney?.VehicleJourneyRef,
                            vehicleRef: item?.MonitoredVehicleJourney?.VehicleRef?.toString(),
                        };
                    }),
                );

                putMetricData(`custom/${namespace}`, [{ MetricName: "MakeFilteredArraySchemaParseError", Value: 1 }]);
            }

            return parsedItem.success;
        });
    }, z.array(vehicleActivitySchema));

export const siriSchema = (errors?: AvlValidationError[]) =>
    z.object({
        Siri: z.object({
            ServiceDelivery: z.object({
                ResponseTimestamp: z.string(),
                ItemIdentifier: createNmTokenSiriValidation("ItemIdentifier", false),
                ProducerRef: createNmTokenOrNumberSiriValidation("ProducerRef"),
                VehicleMonitoringDelivery: z.object({
                    ResponseTimestamp: z.string(),
                    RequestMessageRef: normalizedStringSchema.nullish(),
                    ValidUntil: z.string().nullish(),
                    ShortestPossibleCycle: z.string().nullish(),
                    VehicleActivity: makeFilteredVehicleActivityArraySchema("SiriVmVehicleActivitySchema", errors),
                }),
            }),
        }),
    });

export type SiriVM = z.infer<ReturnType<typeof siriSchema>>;

export const siriSchemaTransformed = (errors?: AvlValidationError[]) =>
    siriSchema(errors).transform((item) => {
        return item.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map((vehicleActivity) => {
            let onwardCalls: Avl["onward_calls"] = [];

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
                response_time_stamp: item.Siri.ServiceDelivery.ResponseTimestamp,
                producer_ref: item.Siri.ServiceDelivery.ProducerRef.toString(),
                recorded_at_time: vehicleActivity.RecordedAtTime,
                item_id: vehicleActivity.ItemIdentifier,
                valid_until_time: vehicleActivity.ValidUntilTime,
                vehicle_monitoring_ref: vehicleActivity.VehicleMonitoringRef ?? null,
                line_ref: vehicleActivity.MonitoredVehicleJourney.LineRef ?? null,
                direction_ref: vehicleActivity.MonitoredVehicleJourney.DirectionRef.toString() ?? null,
                occupancy: vehicleActivity.MonitoredVehicleJourney.Occupancy ?? null,
                operator_ref: vehicleActivity.MonitoredVehicleJourney.OperatorRef,
                data_frame_ref:
                    vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DataFrameRef.toString() ?? null,
                dated_vehicle_journey_ref:
                    vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef.toString() ??
                    null,

                longitude: roundToDecimalPlaces(
                    vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Longitude,
                    MAX_DECIMAL_PRECISION,
                ),
                latitude: roundToDecimalPlaces(
                    vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Latitude,
                    MAX_DECIMAL_PRECISION,
                ),
                bearing:
                    typeof vehicleActivity.MonitoredVehicleJourney.Bearing === "number"
                        ? roundToDecimalPlaces(vehicleActivity.MonitoredVehicleJourney.Bearing, MAX_DECIMAL_PRECISION)
                        : vehicleActivity.MonitoredVehicleJourney.Bearing,
                monitored: vehicleActivity.MonitoredVehicleJourney.Monitored ?? null,
                published_line_name: vehicleActivity.MonitoredVehicleJourney.PublishedLineName ?? null,
                origin_ref: vehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
                origin_name: vehicleActivity.MonitoredVehicleJourney.OriginName ?? null,
                origin_aimed_departure_time: vehicleActivity.MonitoredVehicleJourney.OriginAimedDepartureTime ?? null,
                destination_ref: vehicleActivity.MonitoredVehicleJourney.DestinationRef ?? null,
                destination_name: vehicleActivity.MonitoredVehicleJourney.DestinationName ?? null,
                destination_aimed_arrival_time:
                    vehicleActivity.MonitoredVehicleJourney.DestinationAimedArrivalTime ?? null,
                block_ref: vehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
                vehicle_ref: vehicleActivity.MonitoredVehicleJourney.VehicleRef.toString(),
                vehicle_journey_ref: vehicleActivity.MonitoredVehicleJourney.VehicleJourneyRef ?? null,
                ticket_machine_service_code:
                    vehicleActivity.Extensions?.VehicleJourney?.Operational?.TicketMachine?.TicketMachineServiceCode ??
                    null,
                journey_code:
                    vehicleActivity.Extensions?.VehicleJourney?.Operational?.TicketMachine?.JourneyCode ?? null,
                vehicle_unique_id: vehicleActivity.Extensions?.VehicleJourney?.VehicleUniqueId ?? null,
                driver_ref: vehicleActivity.Extensions?.VehicleJourney?.DriverRef ?? null,
                onward_calls: onwardCalls && onwardCalls.length > 0 ? JSON.stringify(onwardCalls) : null,
            };
        });
    });

export const siriBodsSchemaTransformed = siriSchema().transform((item) => {
    const avls: NewBodsAvl[] = item.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.map<NewBodsAvl>(
        (vehicleActivity) => ({
            response_time_stamp: item.Siri.ServiceDelivery.ResponseTimestamp,
            producer_ref: item.Siri.ServiceDelivery.ProducerRef.toString(),
            recorded_at_time: vehicleActivity.RecordedAtTime,
            valid_until_time: vehicleActivity.ValidUntilTime,
            line_ref: vehicleActivity.MonitoredVehicleJourney.LineRef ?? null,
            direction_ref: vehicleActivity.MonitoredVehicleJourney.DirectionRef.toString() ?? null,
            occupancy: vehicleActivity.MonitoredVehicleJourney.Occupancy ?? null,
            operator_ref: vehicleActivity.MonitoredVehicleJourney.OperatorRef,
            data_frame_ref:
                vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DataFrameRef.toString() ?? null,
            dated_vehicle_journey_ref:
                vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef?.DatedVehicleJourneyRef.toString() ??
                null,
            vehicle_ref: vehicleActivity.MonitoredVehicleJourney.VehicleRef.toString(),
            longitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Longitude,
            latitude: vehicleActivity.MonitoredVehicleJourney.VehicleLocation.Latitude,
            bearing: vehicleActivity.MonitoredVehicleJourney.Bearing ?? null,
            published_line_name: vehicleActivity.MonitoredVehicleJourney.PublishedLineName ?? null,
            origin_ref: vehicleActivity.MonitoredVehicleJourney.OriginRef ?? null,
            origin_aimed_departure_time: vehicleActivity.MonitoredVehicleJourney.OriginAimedDepartureTime ?? null,
            destination_ref: vehicleActivity.MonitoredVehicleJourney.DestinationRef ?? null,
            block_ref: vehicleActivity.MonitoredVehicleJourney.BlockRef ?? null,
        }),
    );

    return avls;
});

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
        vehicle_ref: item.vehicleRef?.replaceAll(NM_TOKEN_DISALLOWED_CHARS_REGEX, ""),
        vehicle_name: item.vehicleName,
        operator_ref: item.operatorRef?.replaceAll(NM_TOKEN_DISALLOWED_CHARS_REGEX, ""),
        monitored: item.monitored,
        longitude: roundToDecimalPlaces(item.longitude, MAX_DECIMAL_PRECISION),
        latitude: roundToDecimalPlaces(item.latitude, MAX_DECIMAL_PRECISION),
        recorded_at_time: recordedAtTime,
        bearing:
            typeof item.bearing === "number" ? roundToDecimalPlaces(item.bearing, MAX_DECIMAL_PRECISION) : item.bearing,
        load: item.load,
        passenger_count: item.passengerCount,
        odometer: item.odometer,
        headway_deviation: item.headwayDeviation,
        schedule_deviation: item.scheduleDeviation,
        vehicle_state: item.vehicleState,
        next_stop_point_id: item.nextStopPointId,
        next_stop_point_name: item.nextStopPointName?.replaceAll(
            SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX,
            "",
        ),
        previous_stop_point_id: item.previousStopPointId,
        previous_stop_point_name: item.previousStopPointName?.replaceAll(
            SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX,
            "",
        ),
        line_ref: item.lineRef?.replaceAll(NM_TOKEN_DISALLOWED_CHARS_REGEX, ""),
        published_line_name: item.publishedLineName?.replaceAll(
            SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX,
            "",
        ),
        direction_ref: item.directionRef.toString(),
        origin_name: item.originName?.replaceAll(SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX, ""),
        origin_ref: item.originRef?.replaceAll(NM_TOKEN_DISALLOWED_CHARS_REGEX, ""),
        origin_aimed_departure_time: originAimedDepartureTime,
        destination_name: item.destinationName?.replaceAll(SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX, ""),
        destination_ref: item.destinationRef?.replaceAll(NM_TOKEN_DISALLOWED_CHARS_REGEX, ""),
        vehicle_journey_ref: item.vehicleJourneyRef?.replaceAll(NM_TOKEN_DISALLOWED_CHARS_REGEX, ""),
    };

    return avl;
});
