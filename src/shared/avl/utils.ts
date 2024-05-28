import cleanDeep from "clean-deep";
import { XMLBuilder } from "fast-xml-parser";
import { sql } from "kysely";
import { Avl, KyselyDb, NewAvl } from "../database";
import { addIntervalToDate, getDate } from "../dates";
import { SiriVM, SiriVehicleActivity, siriSchema } from "../schema";
import { chunkArray } from "../utils";

export const AGGREGATED_SIRI_VM_FILE_PATH = "SIRI-VM.xml";

export const insertAvls = async (dbClient: KyselyDb, avls: NewAvl[], fromBods?: boolean) => {
    const avlsWithGeom = avls.map<NewAvl>((avl) => ({
        ...avl,
        geom: sql`ST_SetSRID(ST_MakePoint(${avl.longitude}, ${avl.latitude}), 4326)`,
    }));

    const insertChunks = chunkArray(avlsWithGeom, 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto(fromBods ? "avl_bods" : "avl")
                .values(chunk)
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
    response_time_stamp: new Date(avl.response_time_stamp).toISOString(),
    recorded_at_time: new Date(avl.recorded_at_time).toISOString(),
    valid_until_time: new Date(avl.valid_until_time).toISOString(),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? new Date(avl.origin_aimed_departure_time).toISOString()
        : null,
});

export const getAvlDataForSiriVm = async (dbClient: KyselyDb) => {
    const avls = await dbClient
        .selectFrom("avl")
        .distinctOn(["operator_ref", "vehicle_ref"])
        .selectAll("avl")
        .orderBy(["operator_ref", "vehicle_ref", "response_time_stamp desc"])
        .execute();

    return avls.map(mapAvlDateStrings);
};

const createVehicleActivities = (avls: Avl[], currentTime: string, validUntilTime: string): SiriVehicleActivity[] => {
    return avls.map<SiriVehicleActivity>((avl) => {
        const vehicleActivity: SiriVehicleActivity = {
            RecordedAtTime: currentTime,
            ValidUntilTime: validUntilTime,
            MonitoredVehicleJourney: {
                LineRef: avl.line_ref,
                DirectionRef: avl.direction_ref,
                PublishedLineName: avl.published_line_name,
                Occupancy: avl.occupancy,
                OperatorRef: avl.operator_ref,
                OriginRef: avl.origin_ref,
                OriginAimedDepartureTime: avl.origin_aimed_departure_time,
                DestinationRef: avl.destination_ref,
                VehicleLocation: {
                    Longitude: avl.longitude,
                    Latitude: avl.latitude,
                },
                Bearing: avl.bearing,
                BlockRef: avl.block_ref,
                VehicleRef: avl.vehicle_ref,
            },
        };

        if (avl.data_frame_ref && avl.dated_vehicle_journey_ref) {
            vehicleActivity.MonitoredVehicleJourney.FramedVehicleJourneyRef = {
                DataFrameRef: avl.data_frame_ref,
                DatedVehicleJourneyRef: avl.dated_vehicle_journey_ref,
            };
        }

        return vehicleActivity;
    });
};

export const convertJsonToSiri = (avls: Avl[], RequestMessageRef: string) => {
    const date = getDate();
    const currentTime = date.toISOString();
    const validUntilTime = addIntervalToDate(date, 5, "minutes").toISOString(); // SIRI-VM ValidUntilTime field is defined as 5 minutes after the current timestamp

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
