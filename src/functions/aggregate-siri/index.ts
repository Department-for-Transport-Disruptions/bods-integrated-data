import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient, putS3Object } from "@bods-integrated-data/shared";
import { Avl, siriSchema } from "@bods-integrated-data/shared/schema/siri.schema";
import { parse } from "js2xmlparser";
import { randomUUID } from "crypto";
import { getCurrentAvlData } from "./database";

const createVehicleActivities = (avl: Avl[], currentTime: string, validUntilTime: string) => {
    return avl.map((record) => {
        const monitoredVehicleJourney = {
            LineRef: record.lineRef,
            DirectionRef: record.directionRef,
            OperatorRef: record.operatorRef,
            FramedVehicleJourneyRef: {
                DatedVehicleJourneyRef: record.datedVehicleJourneyRef,
            },
            VehicleRef: record.vehicleRef,
            DataSource: record.dataSource,
            VehicleLocation: {
                Longitude: record.longitude,
                Latitude: record.latitude,
            },
            Bearing: record.bearing,
            Delay: record.delay,
            IsCompleteStopSequence: record.isCompleteStopSequence,
            PublishedLineName: record.publishedLineName,
            OriginRef: record.originRef,
            DestinationRef: record.destinationRef,
            BlockRef: record.blockRef,
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
        "@": {
            version: "2.0",
            xmlns: "http://www.siri.org.uk/siri",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd",
        },
        ...verifiedObject,
    };

    return parse("Siri", completeObject, {
        declaration: {
            version: "1.0",
            encoding: "UTF-8",
            standalone: "yes",
        },
        useSelfClosingTagIfEmpty: true,
    });
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
        Body: JSON.stringify(siri),
    });
};

export const handler = async () => {
    try {
        logger.info("Starting SIRI-VM generator...");

        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const requestMessageRef = randomUUID();
        const currentTime = new Date();
        const validUntilTime = new Date(currentTime.getTime() + 5 * 60000);

        const db = await getDatabaseClient(process.env.IS_LOCAL === "true");

        const avl = await getCurrentAvlData(db, logger);

        if (!avl || avl.length === 0) {
            logger.warn("No recent AVL data found in the database...");
            return;
        }

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
            logger.error(e.toString());

            throw e;
        }

        throw e;
    }
};
