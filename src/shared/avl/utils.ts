import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import cleanDeep from "clean-deep";
import commandExists from "command-exists";
import { Dayjs } from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { sql } from "kysely";
import { ZodIssue } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { putMetricData } from "../cloudwatch";
import { avlValidationErrorLevelMappings, tflOperatorRef } from "../constants";
import { Avl, BodsAvl, KyselyDb, NewAvl } from "../database";
import { getDate } from "../dates";
import { getDynamoItem, recursiveQuery, recursiveScan } from "../dynamo";
import { logger } from "../logger";
import { putS3Object } from "../s3";
import { SiriVM, SiriVehicleActivity, siriSchema } from "../schema";
import { AvlSubscription, avlSubscriptionSchema, avlSubscriptionsSchema } from "../schema/avl-subscribe.schema";
import { AvlValidationError, avlValidationErrorSchema } from "../schema/avl-validation-error.schema";
import { chunkArray } from "../utils";

export const GENERATED_SIRI_VM_FILE_PATH = "SIRI-VM.xml";
export const GENERATED_SIRI_VM_TFL_FILE_PATH = "SIRI-VM-TfL.xml";

export class SubscriptionIdNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SubscriptionIdNotFoundError";
        Object.setPrototypeOf(this, SubscriptionIdNotFoundError.prototype);
    }
}

export const isActiveAvlSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<AvlSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    return subscription?.status === "live";
};

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
    geom: sql`ST_SetSRID(ST_MakePoint(${avl.longitude}, ${avl.latitude}), 4326)`,
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
                        }))
                        .whereRef("excluded.recorded_at_time", ">", "avl.recorded_at_time"),
                )
                .execute(),
        ),
    );
};

/**
 * Maps AVL timestamp fields as ISO strings.
 * @param avl The AVL
 * @returns The AVL with date strings
 */
export const mapAvlDateStrings = <T extends Avl>(avl: T): T => ({
    ...avl,
    response_time_stamp: formatSiriVmDatetimes(getDate(avl.response_time_stamp), true),
    recorded_at_time: formatSiriVmDatetimes(getDate(avl.recorded_at_time), false),
    valid_until_time: formatSiriVmDatetimes(getDate(avl.valid_until_time), true),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? formatSiriVmDatetimes(getDate(avl.origin_aimed_departure_time), false)
        : null,
    destination_aimed_arrival_time: avl.destination_aimed_arrival_time
        ? formatSiriVmDatetimes(getDate(avl.destination_aimed_arrival_time), false)
        : null,
});

/**
 * Maps AVL timestamp fields as ISO strings.
 * @param avl The AVL
 * @returns The AVL with date strings
 */
export const mapBodsAvlDateStrings = (avl: BodsAvl): BodsAvl => ({
    ...avl,
    response_time_stamp: formatSiriVmDatetimes(getDate(avl.response_time_stamp), true),
    recorded_at_time: formatSiriVmDatetimes(getDate(avl.recorded_at_time), false),
    valid_until_time: formatSiriVmDatetimes(getDate(avl.valid_until_time), true),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? formatSiriVmDatetimes(getDate(avl.origin_aimed_departure_time), false)
        : null,
});

export const getQueryForLatestAvl = (
    dbClient: KyselyDb,
    boundingBox?: number[],
    operatorRef?: string[],
    vehicleRef?: string,
    lineRef?: string,
    producerRef?: string,
    originRef?: string,
    destinationRef?: string,
    subscriptionId?: string,
    recordedAtTimeAfter?: string,
) => {
    let query = dbClient.selectFrom("avl").distinctOn(["operator_ref", "vehicle_ref"]).selectAll("avl");

    if (boundingBox) {
        const [minX, minY, maxX, maxY] = boundingBox;
        const envelope = sql<string>`ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;
        query = query.where(dbClient.fn("ST_Within", ["geom", envelope]), "=", true);
    }

    if (operatorRef) {
        query = query.where("operator_ref", "in", operatorRef);
    }

    if (vehicleRef) {
        query = query.where((qb) =>
            qb.or([
                qb.and([qb("operator_ref", "!=", "TFLO"), qb("vehicle_ref", "=", vehicleRef)]),
                qb.and([qb("operator_ref", "=", "TFLO"), qb("vehicle_name", "=", vehicleRef)]),
            ]),
        );
    }

    if (lineRef) {
        query = query.where("line_ref", "=", lineRef);
    }

    if (producerRef) {
        query = query.where("producer_ref", "=", producerRef);
    }

    if (originRef) {
        query = query.where("origin_ref", "=", originRef);
    }

    if (destinationRef) {
        query = query.where("destination_ref", "=", destinationRef);
    }

    if (subscriptionId) {
        query = query.where("subscription_id", "=", subscriptionId);
    }

    if (recordedAtTimeAfter) {
        query = query.where("recorded_at_time", ">", recordedAtTimeAfter);
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
    subscriptionId?: string,
) => {
    try {
        const dayAgo = getDate().subtract(1, "day").toISOString();

        const query = getQueryForLatestAvl(
            dbClient,
            boundingBox,
            operatorRef,
            vehicleRef,
            lineRef,
            producerRef,
            originRef,
            destinationRef,
            subscriptionId,
            dayAgo,
        );

        const avls = await query.execute();

        return avls.map(mapAvlDateStrings);
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem getting AVL data from the database", error);
        }

        throw error;
    }
};

/**
 * Map database AVLs to SIRI-VM AVLs, stripping any invalid characters as necessary. Characters are stripped here to
 * preserve the original incoming data in the database, but to format for our generated SIRI-VM output.
 * @param avls AVLs
 * @param validUntilTime Valid until time
 * @returns mapped SIRI-VM vehicle activities
 */
export const createVehicleActivities = (avls: Avl[], validUntilTime: string): SiriVehicleActivity[] => {
    return avls.map<SiriVehicleActivity>((avl) => {
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
                Bearing: avl.bearing === "-1" ? null : avl.bearing,
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

        if (avl.ticket_machine_service_code || avl.journey_code || avl.vehicle_unique_id) {
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

        return vehicleActivity;
    });
};

export const formatSiriVmDatetimes = (datetime: Dayjs, includeMilliseconds: boolean) =>
    datetime.format(includeMilliseconds ? "YYYY-MM-DDTHH:mm:ss.SSSZ" : "YYYY-MM-DDTHH:mm:ssZ");

export const createSiriVm = (avls: Avl[], requestMessageRef: string, responseTime: Dayjs) => {
    const currentTime = formatSiriVmDatetimes(responseTime, true);
    const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);
    const vehicleActivities = createVehicleActivities(avls, validUntilTime);

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
                    VehicleActivity: vehicleActivities,
                },
            },
        },
    };

    const siriVmWithoutEmptyFields = cleanDeep(siriVm, { emptyArrays: false });
    const verifiedObject = siriSchema().parse(siriVmWithoutEmptyFields);

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
 * Returns a SIRI-VM valid until time value defined as 5 minutes after the given time.
 * @param time The response time to offset from.
 * @returns The valid until time.
 */
export const getSiriVmValidUntilTimeOffset = (time: Dayjs) => formatSiriVmDatetimes(time.add(5, "minutes"), true);

/**
 * Returns a SIRI-VM termination time value defined as 10 years after the given time.
 * @param time The response time to offset from.
 * @returns The termination.
 */
export const getSiriVmTerminationTimeOffset = (time: Dayjs) => time.add(10, "years").toISOString();

/**
 * Spawns a child process to use the xmllint CLI command in order to validate
 * the SIRI-VM files against the XSD. If the file fails validation then it will
 * throw an error and log out the validation issues.
 *
 * @param xml
 */
const runXmlLint = async (xml: string) => {
    const fileName = randomUUID();
    await writeFile(`/app/${fileName}.xml`, xml, { flag: "w" });

    const command = spawn("xmllint", [
        `/app/${fileName}.xml`,
        "--noout",
        "--nowarning",
        "--schema",
        "/app/xsd/www.siri.org.uk/schema/2.0/xsd/siri.xsd",
    ]);

    let error = "";

    for await (const chunk of command.stderr) {
        error += chunk;
    }

    const exitCode = await new Promise((resolve) => {
        command.on("close", resolve);
    });

    await unlink(`/app/${fileName}.xml`);

    if (exitCode) {
        logger.error(error.slice(0, 10000));

        throw new Error();
    }
};

const createAndValidateSiri = async (
    avls: Avl[],
    requestMessageRef: string,
    responseTime: Dayjs,
    lintSiri: boolean,
    isTfl: boolean,
) => {
    const siriVm = createSiriVm(avls, requestMessageRef, responseTime);

    if (lintSiri) {
        try {
            await runXmlLint(siriVm);
        } catch (e) {
            await putMetricData("custom/SiriVmGenerator", [
                { MetricName: isTfl ? "TfLValidationError" : "ValidationError", Value: 1 },
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
    lintSiri = true,
) => {
    if (lintSiri && !commandExists("xmllint")) {
        throw new Error("xmllint not available");
    }

    const responseTime = getDate();

    const [siriVm, siriVmTfl] = await Promise.all([
        Promise.resolve(createAndValidateSiri(avls, requestMessageRef, responseTime, lintSiri, false)),
        Promise.resolve(
            createAndValidateSiri(
                avls.filter((avl) => avl.operator_ref === tflOperatorRef),
                requestMessageRef,
                responseTime,
                lintSiri,
                true,
            ),
        ),
    ]);

    await Promise.all([
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
};

export interface CompleteSiriObject<T> {
    "?xml": {
        "#text": "";
        "@_version": "1.0";
        "@_encoding": "UTF-8";
        "@_standalone": "yes";
    };
    Siri: {
        "@_version": "2.0";
        "@_xmlns": "http://www.siri.org.uk/siri";
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance";
        "@_xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd";
    } & T;
}

export const getAvlErrorDetails = (error: ZodIssue) => {
    const validationError = fromZodIssue(error, { prefix: null, includePath: false });
    const { path } = validationError.details[0];
    const name = path.join(".");
    const propertyName = path[path.length - 1];

    return {
        name,
        message: validationError.message,
        level: avlValidationErrorLevelMappings[propertyName] || "CRITICAL",
    };
};

export const generateApiKey = () => randomUUID().replaceAll("-", "");

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
