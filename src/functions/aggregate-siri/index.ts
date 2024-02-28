import { parse } from "js2xmlparser";
import * as logger from "lambda-log";
import { randomUUID } from "crypto";
import { getCurrentAvlData } from "./database";
import { getDatabaseClient } from "../../shared";
import { Avl, siriSchema } from "../../shared/schema/siri.schema";

const createVehicleActvities = (avl: Avl[], currentTime: string, validUntilTime: string) => {
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
            Object.entries(monitoredVehicleJourney).filter(([_, v]) => v != null),
        );

        return {
            RecordedAtTime: currentTime,
            ValidUntilTime: validUntilTime,
            MonitoredVehicleJourney: monitoredVehicleJourneyWithNullEntriesRemoved,
        };
    });
};

const convertJsonToSiri = (
    avl: Avl[],
    currentTime: string,
    validUntilTime: string,
    requestMessageIdentifier: string,
) => {
    const vehicleActivity = createVehicleActvities(avl, currentTime, validUntilTime);

    // console.log(vehicleActivity);

    const jsonToXmlObject = {
        ServiceDelivery: {
            ResponseTimestamp: currentTime,
            ProducerRef: "DepartmentForTransport",
            VehicleMonitoringDelivery: {
                ResponseTimestamp: currentTime,
                RequestMessageIdentifier: requestMessageIdentifier,
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

export const handler = async () => {
    try {
        logger.options.dev = process.env.NODE_ENV !== "production";
        logger.options.debug = process.env.ENABLE_DEBUG_LOGS === "true" || process.env.NODE_ENV !== "production";

        logger.options.meta = {
            id: randomUUID(),
        };

        logger.info("Starting SIRI-VM generator...");

        const responseMessageIdentifier = randomUUID();
        const currentTime = new Date();
        const validUntilTime = new Date(currentTime.getTime() + 5 * 60000);

        const db = await getDatabaseClient(process.env.IS_LOCAL === "true");

        const avl = await getCurrentAvlData(db, logger);

        if (!avl || avl.length === 0) {
            logger.warn("No recent AVL data found in the database...");
            return;
        }

        const siri = convertJsonToSiri(
            avl,
            currentTime.toISOString(),
            validUntilTime.toISOString(),
            responseMessageIdentifier,
        );

        console.log(JSON.stringify(siri));
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);

            throw e;
        }

        throw e;
    }
};
