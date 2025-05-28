import { randomUUID } from "node:crypto";
import cleanDeep from "clean-deep";
import { sync as commandExistsSync } from "command-exists";
import { Dayjs } from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { sql } from "kysely";
import { ZodIssue } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { putMetricData } from "../cloudwatch";
import { avlValidationErrorLevelMappings, tflOperatorRef } from "../constants";
import { Avl, KyselyDb, NewAvl, NewAvlCancellations } from "../database";
import { getDate } from "../dates";
import { getDynamoItem, recursiveQuery, recursiveScan } from "../dynamo";
import { logger } from "../logger";
import { putS3Object } from "../s3";
import { SiriVM, SiriVehicleActivity, siriVmSchema } from "../schema";
import { AvlSubscription, avlSubscriptionSchema, avlSubscriptionsSchema } from "../schema/avl-subscribe.schema";
import { AvlValidationError, avlValidationErrorSchema } from "../schema/avl-validation-error.schema";
import { publishToSnsTopic } from "../sns";
import { CompleteSiriObject, SubscriptionIdNotFoundError, chunkArray, formatSiriDatetime, runXmlLint } from "../utils";

export const GENERATED_SIRI_VM_FILE_PATH = "SIRI-VM.xml";
export const GENERATED_SIRI_VM_TFL_FILE_PATH = "SIRI-VM-TfL.xml";

export const getAvlSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions) {
        return [];
    }

    return avlSubscriptionsSchema.parse(subscriptions);
};

export const getAvlSubscriptionErrorData = async (
    tableName: string,
    subscriptionId: string,
): Promise<AvlValidationError[]> => {
    const now = getDate();
    const past24Hours = now.subtract(24, "hours");

    const subscriptionErrors = await recursiveQuery({
        TableName: tableName,
        KeyConditionExpression: "#PK = :subscriptionId",
        FilterExpression: "#recordedAtTime > :past24Hours",
        ExpressionAttributeNames: {
            "#PK": "PK",
            "#recordedAtTime": "recordedAtTime",
        },
        ExpressionAttributeValues: {
            ":subscriptionId": subscriptionId,
            ":past24Hours": past24Hours.toISOString(),
        },
    });

    if (!subscriptionErrors) {
        return [];
    }

    const data = subscriptionErrors.map((e) => avlValidationErrorSchema.parse(e));

    return data;
};

export const getAvlSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<AvlSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return avlSubscriptionSchema.parse(subscription);
};

const includeAdditionalFields = (avl: NewAvl, subscriptionId: string): NewAvl => ({
    ...avl,
    geom: sql`ST_SetSRID
        (ST_MakePoint(${avl.longitude}, ${avl.latitude}), 4326)`,
    subscription_id: subscriptionId,
    item_id: avl.item_id ?? randomUUID(),
});

export const removeDuplicates = <T extends NewAvl | Avl>(avl: T[]): T[] => {
    const uniqueRecordsMap: Map<string, T> = new Map();

    for (const item of avl) {
        const key = `${item.operator_ref}-${item.vehicle_ref}`;

        if (!uniqueRecordsMap.has(key)) {
            uniqueRecordsMap.set(key, item);
        } else {
            const existingRecord = uniqueRecordsMap.get(key);

            if (!existingRecord || getDate(item.recorded_at_time).isAfter(getDate(existingRecord.recorded_at_time))) {
                uniqueRecordsMap.set(key, item);
            }
        }
    }

    return Array.from(uniqueRecordsMap.values()).sort((a, b) => {
        if (a.operator_ref < b.operator_ref) {
            return -1;
        }
        if (a.operator_ref > b.operator_ref) {
            return 1;
        }
        if (a.vehicle_ref < b.vehicle_ref) {
            return -1;
        }
        if (a.vehicle_ref > b.vehicle_ref) {
            return 1;
        }

        return 0;
    });
};

export const insertAvls = async (dbClient: KyselyDb, avls: NewAvl[], subscriptionId: string) => {
    const modifiedAvls = avls.map((avl) => includeAdditionalFields(avl, subscriptionId));

    const insertChunks = chunkArray(removeDuplicates(modifiedAvls), 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto("avl")
                .values(chunk)
                .onConflict((oc) =>
                    oc
                        .columns(["vehicle_ref", "operator_ref"])
                        .doUpdateSet((eb) => ({
                            id: eb.ref("excluded.id"),
                            destination_ref: eb.ref("excluded.destination_ref"),
                            direction_ref: eb.ref("excluded.direction_ref"),
                            geom: eb.ref("excluded.geom"),
                            headway_deviation: eb.ref("excluded.headway_deviation"),
                            item_id: eb.ref("excluded.item_id"),
                            journey_code: eb.ref("excluded.journey_code"),
                            latitude: eb.ref("excluded.latitude"),
                            line_ref: eb.ref("excluded.line_ref"),
                            load: eb.ref("excluded.load"),
                            longitude: eb.ref("excluded.longitude"),
                            monitored: eb.ref("excluded.monitored"),
                            next_stop_point_id: eb.ref("excluded.next_stop_point_id"),
                            next_stop_point_name: eb.ref("excluded.next_stop_point_name"),
                            occupancy: eb.ref("excluded.occupancy"),
                            odometer: eb.ref("excluded.odometer"),
                            origin_aimed_departure_time: eb.ref("excluded.origin_aimed_departure_time"),
                            origin_name: eb.ref("excluded.origin_name"),
                            origin_ref: eb.ref("excluded.origin_ref"),
                            passenger_count: eb.ref("excluded.passenger_count"),
                            previous_stop_point_id: eb.ref("excluded.previous_stop_point_id"),
                            previous_stop_point_name: eb.ref("excluded.previous_stop_point_name"),
                            producer_ref: eb.ref("excluded.producer_ref"),
                            published_line_name: eb.ref("excluded.published_line_name"),
                            recorded_at_time: eb.ref("excluded.recorded_at_time"),
                            response_time_stamp: eb.ref("excluded.response_time_stamp"),
                            schedule_deviation: eb.ref("excluded.schedule_deviation"),
                            subscription_id: eb.ref("excluded.subscription_id"),
                            ticket_machine_service_code: eb.ref("excluded.ticket_machine_service_code"),
                            valid_until_time: eb.ref("excluded.valid_until_time"),
                            vehicle_journey_ref: eb.ref("excluded.vehicle_journey_ref"),
                            vehicle_monitoring_ref: eb.ref("excluded.vehicle_monitoring_ref"),
                            vehicle_name: eb.ref("excluded.vehicle_name"),
                            vehicle_state: eb.ref("excluded.vehicle_state"),
                            vehicle_unique_id: eb.ref("excluded.vehicle_unique_id"),
                            destination_name: eb.ref("excluded.destination_name"),
                            destination_aimed_arrival_time: eb.ref("excluded.destination_aimed_arrival_time"),
                            dated_vehicle_journey_ref: eb.ref("excluded.dated_vehicle_journey_ref"),
                            data_frame_ref: eb.ref("excluded.data_frame_ref"),
                            block_ref: eb.ref("excluded.block_ref"),
                            bearing: eb.ref("excluded.bearing"),
                            onward_calls: eb.ref("excluded.onward_calls"),
                            driver_ref: eb.ref("excluded.driver_ref"),
                            route_id: eb.ref("excluded.route_id"),
                            trip_id: eb.ref("excluded.trip_id"),
                        }))
                        .whereRef("excluded.recorded_at_time", ">", "avl.recorded_at_time"),
                )
                .execute(),
        ),
    );
};

export const insertAvlCancellations = async (
    dbClient: KyselyDb,
    avlsCancellations: NewAvlCancellations[],
    subscriptionId: string,
) => {
    const modifiedAvlsCancellations = avlsCancellations.map((cancellation) => ({
        ...cancellation,
        subscription_id: subscriptionId,
    }));
    const insertChunks = chunkArray(modifiedAvlsCancellations, 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto("avl_cancellation")
                .values(chunk)
                .onConflict((oc) =>
                    oc
                        .columns(["data_frame_ref", "dated_vehicle_journey_ref", "line_ref", "direction_ref"])
                        .doUpdateSet((eb) => ({
                            id: eb.ref("excluded.id"),
                            response_time_stamp: eb.ref("excluded.response_time_stamp"),
                            recorded_at_time: eb.ref("excluded.recorded_at_time"),
                            vehicle_monitoring_ref: eb.ref("excluded.vehicle_monitoring_ref"),
                            data_frame_ref: eb.ref("excluded.data_frame_ref"),
                            dated_vehicle_journey_ref: eb.ref("excluded.dated_vehicle_journey_ref"),
                            line_ref: eb.ref("excluded.line_ref"),
                            direction_ref: eb.ref("excluded.direction_ref"),
                            subscription_id: eb.ref("excluded.subscription_id"),
                        }))
                        .whereRef("excluded.recorded_at_time", ">", "avl_cancellation.recorded_at_time"),
                )
                .execute(),
        ),
    );
};

/**
 * Maps various AVL fields into more usable formats.
 * @param avl The AVL
 * @returns The mapped AVL
 */
export const mapAvlFieldsIntoUsableFormats = <T extends Avl>(avl: T): T => ({
    ...avl,
    id: Number.parseInt(avl.id as unknown as string),
    response_time_stamp: formatSiriDatetime(getDate(avl.response_time_stamp), true),
    recorded_at_time: formatSiriDatetime(getDate(avl.recorded_at_time), false),
    valid_until_time: formatSiriDatetime(getDate(avl.valid_until_time), true),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? formatSiriDatetime(getDate(avl.origin_aimed_departure_time), false)
        : null,
    destination_aimed_arrival_time: avl.destination_aimed_arrival_time
        ? formatSiriDatetime(getDate(avl.destination_aimed_arrival_time), false)
        : null,
});

export interface AvlQueryOptions {
    boundingBox?: number[];
    operatorRef?: string[];
    vehicleRef?: string;
    lineRef?: string;
    producerRef?: string;
    originRef?: string;
    destinationRef?: string;
    subscriptionId?: string[];
    lastRetrievedAvlId?: number;
    recordedAtTimeAfter?: string;
    routeId?: number[];
    startTimeBefore?: number;
    startTimeAfter?: number;
}

export const getQueryForLatestAvl = (dbClient: KyselyDb, avlQueryOptions: AvlQueryOptions) => {
    let query = dbClient.selectFrom("avl").distinctOn(["operator_ref", "vehicle_ref"]).selectAll("avl");

    const enableCancellations = process.env.ENABLE_CANCELLATIONS === "true";

    if (enableCancellations) {
        query = query
            .leftJoin("avl_cancellation", (join) =>
                join
                    .onRef("avl_cancellation.data_frame_ref", "=", "avl.data_frame_ref")
                    .onRef("avl_cancellation.dated_vehicle_journey_ref", "=", "avl.dated_vehicle_journey_ref")
                    .onRef("avl_cancellation.line_ref", "=", "avl.line_ref")
                    .onRef("avl_cancellation.direction_ref", "=", "avl.direction_ref")
                    .onRef("avl_cancellation.subscription_id", "=", "avl.subscription_id"),
            )
            .where("avl_cancellation.dated_vehicle_journey_ref", "is", null);
    }

    if (avlQueryOptions.boundingBox) {
        const [minX, minY, maxX, maxY] = avlQueryOptions.boundingBox;
        const envelope = sql<string>`ST_MakeEnvelope
            (${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;
        query = query.where(dbClient.fn("ST_Within", ["geom", envelope]), "=", true);
    }

    if (avlQueryOptions.operatorRef) {
        query = query.where("operator_ref", "in", avlQueryOptions.operatorRef);
    }

    if (avlQueryOptions.vehicleRef !== undefined) {
        const vehicleRef = avlQueryOptions.vehicleRef;
        query = query.where((qb) =>
            qb.or([
                qb.and([qb("operator_ref", "!=", "TFLO"), qb("vehicle_ref", "=", vehicleRef)]),
                qb.and([qb("operator_ref", "=", "TFLO"), qb("vehicle_name", "=", vehicleRef)]),
            ]),
        );
    }

    if (avlQueryOptions.lineRef) {
        query = query.where("avl.line_ref", "=", avlQueryOptions.lineRef);
    }

    if (avlQueryOptions.producerRef) {
        query = query.where("producer_ref", "=", avlQueryOptions.producerRef);
    }

    if (avlQueryOptions.originRef) {
        query = query.where("origin_ref", "=", avlQueryOptions.originRef);
    }

    if (avlQueryOptions.destinationRef) {
        query = query.where("destination_ref", "=", avlQueryOptions.destinationRef);
    }

    if (avlQueryOptions.subscriptionId) {
        query = query.where("avl.subscription_id", "in", avlQueryOptions.subscriptionId);
    }

    if (avlQueryOptions.lastRetrievedAvlId) {
        query = query.where("avl.id", ">", avlQueryOptions.lastRetrievedAvlId);
    }

    if (avlQueryOptions.recordedAtTimeAfter) {
        query = query.where("avl.recorded_at_time", ">", avlQueryOptions.recordedAtTimeAfter);
    }

    if (avlQueryOptions.routeId) {
        query = query.where("route_id", "in", avlQueryOptions.routeId);
    }

    if (avlQueryOptions.startTimeBefore) {
        query = query.where(
            "avl.origin_aimed_departure_time",
            "<",
            sql<string>`to_timestamp(${avlQueryOptions.startTimeBefore})`,
        );
    }

    if (avlQueryOptions.startTimeAfter) {
        query = query.where(
            "avl.origin_aimed_departure_time",
            ">",
            sql<string>`to_timestamp(${avlQueryOptions.startTimeAfter})`,
        );
    }

    return query.orderBy(["avl.operator_ref", "avl.vehicle_ref", "avl.recorded_at_time desc"]);
};

export const getAvlDataForSiriVm = async (
    dbClient: KyselyDb,
    boundingBox?: number[],
    operatorRef?: string[],
    vehicleRef?: string,
    lineRef?: string,
    producerRef?: string,
    originRef?: string,
    destinationRef?: string,
    subscriptionId?: string[],
    lastRetrievedAvlId?: number,
) => {
    try {
        const dayAgo = getDate().subtract(1, "day").toISOString();

        const query = getQueryForLatestAvl(dbClient, {
            boundingBox,
            operatorRef,
            vehicleRef,
            lineRef,
            producerRef,
            originRef,
            destinationRef,
            subscriptionId,
            lastRetrievedAvlId,
            recordedAtTimeAfter: dayAgo,
        });

        const avls = await query.execute();

        return avls.map(mapAvlFieldsIntoUsableFormats);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem getting AVL data from the database");
        }

        throw e;
    }
};

/**
 * Map database AVLs to SIRI-VM AVLs, stripping any invalid characters as necessary. Characters are stripped here to
 * preserve the original incoming data in the database, but to format for our generated SIRI-VM output.
 * @param avls AVLs
 * @param validUntilTime Valid until time
 * @returns mapped SIRI-VM vehicle activities
 */
export const createVehicleActivities = (avls: Avl[], responseTime: Dayjs): Partial<SiriVehicleActivity>[] => {
    const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);

    return avls.map((avl) => {
        const vehicleActivity: SiriVehicleActivity = {
            RecordedAtTime: avl.recorded_at_time,
            ItemIdentifier: avl.item_id,
            ValidUntilTime: validUntilTime,
            MonitoredVehicleJourney: {
                LineRef: avl.line_ref,
                DirectionRef: avl.direction_ref,
                PublishedLineName: avl.published_line_name,
                Occupancy: avl.occupancy,
                OperatorRef: avl.operator_ref,
                OriginRef: avl.origin_ref,
                OriginName: avl.origin_name,
                OriginAimedDepartureTime: avl.origin_aimed_departure_time,
                DestinationRef: avl.destination_ref,
                DestinationName: avl.destination_name,
                DestinationAimedArrivalTime: avl.destination_aimed_arrival_time,
                Monitored: avl.monitored,
                VehicleLocation: {
                    Longitude: avl.longitude,
                    Latitude: avl.latitude,
                },
                Bearing: avl.bearing === -1 ? null : avl.bearing,
                BlockRef: avl.block_ref,
                VehicleRef: avl.operator_ref === "TFLO" ? avl.vehicle_name || avl.vehicle_ref : avl.vehicle_ref,
                VehicleJourneyRef: avl.vehicle_journey_ref,
            },
        };

        if (avl.data_frame_ref && avl.dated_vehicle_journey_ref) {
            vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef = {
                DataFrameRef: avl.data_frame_ref,
                DatedVehicleJourneyRef: avl.dated_vehicle_journey_ref,
            };
        }

        if (avl.ticket_machine_service_code || avl.journey_code || avl.vehicle_unique_id || avl.driver_ref) {
            vehicleActivity.Extensions = {
                VehicleJourney: {
                    Operational: {
                        TicketMachine: {
                            TicketMachineServiceCode: avl.ticket_machine_service_code ?? null,
                            JourneyCode: avl.journey_code ?? null,
                        },
                    },
                    VehicleUniqueId: avl.vehicle_unique_id ?? null,
                    DriverRef: avl.driver_ref ?? null,
                },
            };
        }

        return cleanDeep(vehicleActivity, { emptyArrays: true });
    });
};

export const createSiriVm = (
    vehicleActivities: Partial<SiriVehicleActivity>[],
    requestMessageRef: string,
    responseTime: Dayjs,
) => {
    const currentTime = formatSiriDatetime(responseTime, true);
    const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);

    const siriVm: SiriVM = {
        Siri: {
            ServiceDelivery: {
                ResponseTimestamp: currentTime,
                ProducerRef: "DepartmentForTransport",
                VehicleMonitoringDelivery: {
                    ResponseTimestamp: currentTime,
                    RequestMessageRef: requestMessageRef,
                    ValidUntil: validUntilTime,
                    ShortestPossibleCycle: "PT5S",
                    VehicleActivity: vehicleActivities as SiriVehicleActivity[],
                },
            },
        },
    };

    const verifiedObject = siriVmSchema().parse(siriVm);

    const completeObject: Partial<CompleteSiriObject<SiriVM["Siri"]>> = {
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd",
            ...verifiedObject.Siri,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: false,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};

/**
 * Returns a SIRI valid until time value defined as 5 minutes after the given time.
 * @param time The response time to offset from.
 * @returns The valid until time.
 */
export const getSiriVmValidUntilTimeOffset = (time: Dayjs) => formatSiriDatetime(time.add(5, "minutes"), true);

const createAndValidateSiri = async (
    vehicleActivities: Partial<SiriVehicleActivity>[],
    requestMessageRef: string,
    responseTime: Dayjs,
    lintSiri: boolean,
    isTfl: boolean,
) => {
    const siriVm = createSiriVm(vehicleActivities, requestMessageRef, responseTime);

    if (lintSiri) {
        try {
            await runXmlLint(siriVm);
        } catch (e) {
            await putMetricData("custom/SiriVmGenerator", [
                {
                    MetricName: isTfl ? "TfLValidationError" : "ValidationError",
                    Value: 1,
                },
            ]);

            logger.error(e);

            throw e;
        }
    }

    return siriVm;
};

export const generateSiriVmAndUploadToS3 = async (
    avls: Avl[],
    requestMessageRef: string,
    bucketName: string,
    snsTopicArn: string,
    lintSiri = true,
) => {
    logger.info("Generating SIRI-VM...");

    if (lintSiri && !commandExistsSync("xmllint")) {
        throw new Error("xmllint not available");
    }

    const responseTime = getDate();

    const vehicleActivities = createVehicleActivities(avls, responseTime);

    const [siriVm, siriVmTfl] = await Promise.all([
        Promise.resolve(createAndValidateSiri(vehicleActivities, requestMessageRef, responseTime, lintSiri, false)),
        Promise.resolve(
            createAndValidateSiri(
                vehicleActivities.filter((v) => v.MonitoredVehicleJourney?.OperatorRef === tflOperatorRef),
                requestMessageRef,
                responseTime,
                lintSiri,
                true,
            ),
        ),
    ]);

    const [siriVmPutResponse, _] = await Promise.all([
        putS3Object({
            Bucket: bucketName,
            Key: GENERATED_SIRI_VM_FILE_PATH,
            ContentType: "application/xml",
            Body: siriVm,
        }),
        putS3Object({
            Bucket: bucketName,
            Key: GENERATED_SIRI_VM_TFL_FILE_PATH,
            ContentType: "application/xml",
            Body: siriVmTfl,
        }),
    ]);

    if (siriVmPutResponse.VersionId) {
        await publishToSnsTopic(
            snsTopicArn,
            JSON.stringify({
                bucket: bucketName,
                key: GENERATED_SIRI_VM_FILE_PATH,
                versionId: siriVmPutResponse.VersionId,
            }),
            "SIRIVM",
        );
    }

    logger.info("SIRI-VM generated and uploaded to S3");
};

export const getAvlErrorDetails = (error: ZodIssue) => {
    const validationError = fromZodIssue(error, {
        prefix: null,
        includePath: false,
    });
    const { path } = validationError.details[0];
    const name = path.join(".");
    const propertyName = path[path.length - 1];

    return {
        name,
        message: validationError.message,
        level: avlValidationErrorLevelMappings[propertyName] || "CRITICAL",
    };
};

/**
 * Returns a count of unique vehicles from the last 24 hours
 * which will be present in the latest SIRI-VM file
 *
 * @param dbClient
 */
export const getLatestAvlVehicleCount = (dbClient: KyselyDb) => {
    const dayAgo = getDate().subtract(1, "day").toISOString();

    return dbClient
        .selectFrom("avl")
        .where("recorded_at_time", ">", dayAgo)
        .select((eb) => eb.fn.countAll<number>().as("vehicle_count"))
        .executeTakeFirstOrThrow();
};
