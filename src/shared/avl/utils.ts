import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import cleanDeep from "clean-deep";
import { Dayjs } from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { sql } from "kysely";
import { tflOperatorRef } from "../constants";
import { Avl, BodsAvl, KyselyDb, NewAvl, NewAvlOnwardCall } from "../database";
import { getDate } from "../dates";
import { getDynamoItem, recursiveScan } from "../dynamo";
import { putS3Object } from "../s3";
import { SiriVM, SiriVehicleActivity, siriSchema } from "../schema";
import { SiriSchemaTransformed } from "../schema";
import { AvlSubscription, avlSubscriptionSchema, avlSubscriptionsSchema } from "../schema/avl-subscribe.schema";
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

    return subscription?.status === "LIVE";
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

export const insertAvls = async (dbClient: KyselyDb, avls: NewAvl[], subscriptionId: string) => {
    const modifiedAvls = avls.map((avl) => includeAdditionalFields(avl, subscriptionId));

    const insertChunks = chunkArray(modifiedAvls, 1000);

    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("avl").values(chunk).execute()));
};

export const insertAvlsWithOnwardCalls = async (
    dbClient: KyselyDb,
    avlsWithOnwardCalls: SiriSchemaTransformed,
    subscriptionId: string,
) => {
    await Promise.all(
        avlsWithOnwardCalls.map(async ({ onward_calls, ...avl }) => {
            const modifiedAvl = includeAdditionalFields(avl, subscriptionId);

            const res = await dbClient.insertInto("avl").values(modifiedAvl).returning("avl.id").executeTakeFirst();

            if (!!onward_calls && !!res) {
                const onwardCalls: NewAvlOnwardCall[] = onward_calls.map((onwardCall) => ({
                    ...onwardCall,
                    avl_id: res.id,
                }));

                await dbClient.insertInto("avl_onward_call").values(onwardCalls).execute();
            }
        }),
    );
};

/**
 * Maps AVL timestamp fields as ISO strings.
 * @param avl The AVL
 * @returns The AVL with date strings
 */
export const mapAvlDateStrings = <T extends Avl>(avl: T): T => ({
    ...avl,
    response_time_stamp: new Date(avl.response_time_stamp).toISOString(),
    recorded_at_time: new Date(avl.recorded_at_time).toISOString(),
    valid_until_time: new Date(avl.valid_until_time).toISOString(),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? new Date(avl.origin_aimed_departure_time).toISOString()
        : null,
    destination_aimed_arrival_time: avl.destination_aimed_arrival_time
        ? new Date(avl.destination_aimed_arrival_time).toISOString()
        : null,
});

/**
 * Maps AVL timestamp fields as ISO strings.
 * @param avl The AVL
 * @returns The AVL with date strings
 */
export const mapBodsAvlDateStrings = (avl: BodsAvl): BodsAvl => ({
    ...avl,
    response_time_stamp: new Date(avl.response_time_stamp).toISOString(),
    recorded_at_time: new Date(avl.recorded_at_time).toISOString(),
    valid_until_time: new Date(avl.valid_until_time).toISOString(),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? new Date(avl.origin_aimed_departure_time).toISOString()
        : null,
});

export const getQueryForLatestAvl = (
    dbClient: KyselyDb,
    boundingBox?: string,
    operatorRef?: string,
    vehicleRef?: string,
    lineRef?: string,
    producerRef?: string,
    originRef?: string,
    destinationRef?: string,
    subscriptionId?: string,
) => {
    let query = dbClient.selectFrom("avl").distinctOn(["operator_ref", "vehicle_ref"]).selectAll("avl");

    if (boundingBox) {
        const [minX, minY, maxX, maxY] = boundingBox.split(",").map((coord) => Number(coord));
        const envelope = sql<string>`ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;
        query = query.where(dbClient.fn("ST_Within", ["geom", envelope]), "=", true);
    }

    if (operatorRef) {
        query = query.where("operator_ref", "in", operatorRef.split(","));
    }

    if (vehicleRef) {
        query = query.where("vehicle_ref", "=", vehicleRef);
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

    return query.orderBy(["avl.operator_ref", "avl.vehicle_ref", "avl.recorded_at_time desc"]);
};

export const getAvlDataForSiriVm = async (
    dbClient: KyselyDb,
    boundingBox?: string,
    operatorRef?: string,
    vehicleRef?: string,
    lineRef?: string,
    producerRef?: string,
    originRef?: string,
    destinationRef?: string,
    subscriptionId?: string,
) => {
    try {
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

const createVehicleActivities = (avls: Avl[], currentTime: string, validUntilTime: string): SiriVehicleActivity[] => {
    return avls.map<SiriVehicleActivity>((avl) => {
        const vehicleActivity: SiriVehicleActivity = {
            RecordedAtTime: currentTime,
            ItemIdentifier: avl.item_id,
            ValidUntilTime: validUntilTime,
            VehicleMonitoringRef: avl.vehicle_monitoring_ref,
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
                Bearing: avl.bearing,
                BlockRef: avl.block_ref,
                VehicleRef: avl.vehicle_ref,
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
                },
            };
        }

        return vehicleActivity;
    });
};

export const createSiriVm = (avls: Avl[], requestMessageRef: string, responseTime: Dayjs) => {
    const currentTime = responseTime.toISOString();
    const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);

    const vehicleActivity = createVehicleActivities(avls, currentTime, validUntilTime);

    const siriVm: SiriVM = {
        ServiceDelivery: {
            ResponseTimestamp: currentTime,
            ProducerRef: "DepartmentForTransport",
            VehicleMonitoringDelivery: {
                ResponseTimestamp: currentTime,
                RequestMessageRef: requestMessageRef,
                ValidUntil: validUntilTime,
                VehicleActivity: vehicleActivity,
            },
        },
    };

    const siriVmWithoutEmptyFields = cleanDeep(siriVm, { emptyArrays: false, emptyStrings: false });
    const verifiedObject = siriSchema.parse(siriVmWithoutEmptyFields);

    const completeObject = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xmlns:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd",
            ...verifiedObject,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
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
export const getSiriVmValidUntilTimeOffset = (time: Dayjs) => time.add(5, "minutes").toISOString();

/**
 * Returns a SIRI-VM termination time value defined as 10 years after the given time.
 * @param time The response time to offset from.
 * @returns The termination.
 */
export const getSiriVmTerminationTimeOffset = (time: Dayjs) => time.add(10, "years").toISOString();

export const generateSiriVmAndUploadToS3 = async (avls: Avl[], requestMessageRef: string, bucketName: string) => {
    const responseTime = getDate();
    const siriVm = createSiriVm(avls, requestMessageRef, responseTime);
    const siriVmTfl = createSiriVm(
        avls.filter((avl) => avl.operator_ref === tflOperatorRef),
        requestMessageRef,
        responseTime,
    );

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
