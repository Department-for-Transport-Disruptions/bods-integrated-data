import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared/dates";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { Avl, siriSchema } from "@bods-integrated-data/shared/schema";
import { XMLBuilder } from "fast-xml-parser";
import { randomUUID } from "crypto";
import { getCurrentAvlData } from "./database";

const currentTime = getDate();
//SIRI-VM ValidUntilTime field is defined as 5 minutes after the current timestamp
const validUntilTime = addIntervalToDate(currentTime, 5, "minutes");

const createVehicleActivities = (avl: Avl[], currentTime: string, validUntilTime: string) => {
    return avl.map((record) => {
        const monitoredVehicleJourney = {
            LineRef: record.line_ref,
            DirectionRef: record.direction_ref,
            FramedVehicleJourneyRef:
                record.data_frame_ref && record.dated_vehicle_journey_ref
                    ? {
                          DataFrameRef: record.data_frame_ref,
                          DatedVehicleJourneyRef: record.dated_vehicle_journey_ref,
                      }
                    : null,
            PublishedLineName: record.published_line_name,
            Occupancy: record.occupancy,
            OperatorRef: record.operator_ref,
            OriginRef: record.origin_ref,
            OriginAimedDepartureTime: record.origin_aimed_departure_time,
            DestinationRef: record.destination_ref,
            VehicleLocation: {
                Longitude: record.longitude,
                Latitude: record.latitude,
            },
            Bearing: record.bearing,
            BlockRef: record.block_ref,
            VehicleRef: record.vehicle_ref,
        };

        const monitoredVehicleJourneyWithNullEntriesRemoved = Object.fromEntries(
            Object.entries(monitoredVehicleJourney).filter(([, value]) => value != null),
        );

        return {
            RecordedAtTime: currentTime,
            ValidUntilTime: validUntilTime,
            MonitoredVehicleJourney: monitoredVehicleJourneyWithNullEntriesRemoved,
        };
    });
};

export const convertJsonToSiri = (
    avl: Avl[],
    currentTime: string,
    validUntilTime: string,
    RequestMessageRef: string,
) => {
    const vehicleActivity = createVehicleActivities(avl, currentTime, validUntilTime);

    const jsonToXmlObject = {
        ServiceDelivery: {
            ResponseTimestamp: currentTime,
            ProducerRef: "DepartmentForTransport",
            VehicleMonitoringDelivery: {
                ResponseTimestamp: currentTime,
                RequestMessageRef: RequestMessageRef,
                ValidUntil: validUntilTime,
                VehicleActivity: vehicleActivity,
            },
        },
    };

    logger.info("Verifying JSON against schema...");
    const verifiedObject = siriSchema.parse(jsonToXmlObject);

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

export const generateSiriVmAndUploadToS3 = async (
    avl: Avl[],
    currentTime: string,
    validUntilTime: string,
    requestMessageRef: string,
    bucketName: string,
) => {
    const siri = convertJsonToSiri(avl, currentTime, validUntilTime, requestMessageRef);

    logger.info("Uploading SIRI-VM data to S3");

    await putS3Object({
        Bucket: bucketName,
        Key: "SIRI-VM.xml",
        ContentType: "application/xml",
        Body: siri,
    });
};

export const handler = async () => {
    const db = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting SIRI-VM generator...");

        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const requestMessageRef = randomUUID();

        const avl = await getCurrentAvlData(db);

        await generateSiriVmAndUploadToS3(
            avl,
            currentTime.toISOString(),
            validUntilTime.toISOString(),
            requestMessageRef,
            bucketName,
        );

        logger.info("Successfully uploaded SIRI-VM data to S3");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Error aggregating AVL data", e);
        }

        throw e;
    } finally {
        await db.destroy();
    }
};
