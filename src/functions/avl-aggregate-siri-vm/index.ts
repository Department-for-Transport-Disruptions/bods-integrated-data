import { logger } from "@baselime/lambda-logger";
import { AGGREGATED_SIRI_VM_FILE_PATH } from "@bods-integrated-data/shared/avl/utils";
import { Avl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared/dates";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { SiriVM, SiriVehicleActivity, siriSchema } from "@bods-integrated-data/shared/schema";
import cleanDeep from "clean-deep";
import { XMLBuilder } from "fast-xml-parser";
import { randomUUID } from "crypto";
import { getCurrentAvlData } from "./database";

const currentTime = getDate();
//SIRI-VM ValidUntilTime field is defined as 5 minutes after the current timestamp
const validUntilTime = addIntervalToDate(currentTime, 5, "minutes");

const createVehicleActivities = (avls: Avl[], currentTime: string, validUntilTime: string): SiriVehicleActivity[] => {
    return avls.map<SiriVehicleActivity>((avl) => {
        const vehicleActivity: SiriVehicleActivity = {
            RecordedAtTime: currentTime,
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
                VehicleLocation: {
                    Longitude: avl.longitude,
                    Latitude: avl.latitude,
                },
                Bearing: avl.bearing,
                BlockRef: avl.block_ref,
                VehicleJourneyRef: avl.vehicle_journey_ref,
                VehicleRef: avl.vehicle_ref,
            },
        };

        if (avl.data_frame_ref && avl.dated_vehicle_journey_ref) {
            vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef = {
                DataFrameRef: avl.data_frame_ref,
                DatedVehicleJourneyRef: avl.dated_vehicle_journey_ref,
            };
        }


        if (avl.ticket_machine_service_code || avl.journey_code) {
            vehicleActivity.MonitoredVehicleJourney.Extensions = {
                VehicleJourney: {
                    Operational: {
                        TicketMachine: {},
                    },
                },
            };

            if (avl.ticket_machine_service_code) {
                vehicleActivity.MonitoredVehicleJourney.Extensions = {
                    VehicleJourney: {
                        Operational: {
                            TicketMachine: {
                                TicketMachineServiceCode: avl.ticket_machine_service_code,
                            },
                        },
                    },

                };
            }

            if (avl.journey_code) {
                vehicleActivity.MonitoredVehicleJourney.Extensions = {
                    VehicleJourney: {
                        Operational: {
                            TicketMachine: {
                                JourneyCode: avl.journey_code,
                            },
                        },
                    },
                };
            }
        }

        console.log(vehicleActivity);

        return vehicleActivity;
    });
};

export const convertJsonToSiri = (
    avls: Avl[],
    currentTime: string,
    validUntilTime: string,
    RequestMessageRef: string,
) => {
    const vehicleActivity = createVehicleActivities(avls, currentTime, validUntilTime);

    const siriVm: SiriVM = {
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
    const verifiedObject = siriSchema.parse(cleanDeep(siriVm));

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
    avls: Avl[],
    currentTime: string,
    validUntilTime: string,
    requestMessageRef: string,
    bucketName: string,
) => {
    const siri = convertJsonToSiri(avls, currentTime, validUntilTime, requestMessageRef);

    logger.info("Uploading SIRI-VM data to S3");

    await putS3Object({
        Bucket: bucketName,
        Key: AGGREGATED_SIRI_VM_FILE_PATH,
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
