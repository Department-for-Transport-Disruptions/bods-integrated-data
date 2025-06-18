import {
    getDatabaseClient,
    KyselyDb,
    NaptanStop,
    NaptanStopArea,
    NewNaptanStop,
    NewNaptanStopArea,
} from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { naptanSchema } from "@bods-integrated-data/shared/schema/naptan.schema";
import { S3Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import { XMLParser } from "fast-xml-parser";
import OsPoint from "ospoint";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const arrayProperties = ["StopPoint", "StopArea", "StopAreaRef"];

export const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml);
    const parsedNaptanData = naptanSchema.parse(parsedXml);

    const stopPoints = parsedNaptanData.NaPTAN.StopPoints.StopPoint.map<NewNaptanStop>((stop) => {
        return {
            atco_code: stop.AtcoCode.toUpperCase(),
            naptan_code: stop.NaptanCode ?? null,
            plate_code: stop.PlateCode ?? null,
            cleardown_code: stop.CleardownCode ?? null,
            common_name: stop.Descriptor.CommonName ?? null,
            short_common_name: stop.Descriptor.ShortCommonName ?? null,
            landmark: stop.Descriptor.Landmark ?? null,
            street: stop.Descriptor.Street ?? null,
            crossing: stop.Descriptor.Crossing ?? null,
            indicator: stop.Descriptor.Indicator ?? null,
            bearing:
                stop.StopClassification.OnStreet?.Bus?.MarkedPoint?.Bearing.CompassPoint ??
                stop.StopClassification.OnStreet?.Bus?.UnmarkedPoint?.Bearing.CompassPoint ??
                null,
            nptg_locality_code: stop.Place.NptgLocalityRef,
            locality_name: stop.Place.LocalityName ?? null,
            town: stop.Place.Town ?? null,
            suburb: stop.Place.Suburb ?? null,
            locality_centre: stop.Place.LocalityCentre ?? null,
            grid_type: stop.Place.Location.Translation?.GridType ?? null,
            easting: stop.Place.Location.Translation?.Easting || stop.Place.Location.Easting || null,
            northing: stop.Place.Location.Translation?.Northing || stop.Place.Location.Northing || null,
            longitude: stop.Place.Location.Translation?.Longitude || stop.Place.Location.Longitude || null,
            latitude: stop.Place.Location.Translation?.Latitude || stop.Place.Location.Latitude || null,
            stop_type: stop.StopClassification.StopType,
            bus_stop_type: stop.StopClassification.OnStreet?.Bus?.BusStopType,
            timing_status:
                stop.StopClassification.OnStreet?.Bus?.TimingStatus ??
                stop.StopClassification.OffStreet?.BusAndCoach?.Bay?.TimingStatus ??
                stop.StopClassification.OffStreet?.BusAndCoach?.VariableBay?.TimingStatus ??
                null,
            default_wait_time: stop.StopClassification.OnStreet?.Bus?.MarkedPoint?.DefaultWaitTime ?? null,
            notes: stop.StopFurtherDetails?.Notes ?? null,
            administrative_area_code: stop.AdministrativeAreaRef,
            creation_date_time: null,
            modification_date_time: null,
            revision_number: null,
            modification: null,
            status: null,
            stop_area_code:
                stop.StopAreas?.StopAreaRef?.length === 1 ? stop.StopAreas.StopAreaRef[0].toUpperCase() : null,
        };
    });

    const stopAreas =
        parsedNaptanData.NaPTAN.StopAreas?.StopArea.map<NewNaptanStopArea>((stopArea) => {
            return {
                stop_area_code: stopArea.StopAreaCode.toUpperCase(),
                name: stopArea.Name,
                administrative_area_code: stopArea.AdministrativeAreaRef,
                stop_area_type: stopArea.StopAreaType,
                grid_type: stopArea.Location.Translation?.GridType ?? null,
                easting: stopArea.Location.Translation?.Easting ?? null,
                northing: stopArea.Location.Translation?.Northing ?? null,
                longitude: stopArea.Location.Translation?.Longitude ?? null,
                latitude: stopArea.Location.Translation?.Latitude ?? null,
            };
        }) ?? [];

    return { stopPoints, stopAreas };
};

const addLonAndLatData = (naptanData: unknown[]) => {
    return (
        naptanData as {
            longitude: string;
            latitude: string;
            easting: string;
            northing: string;
        }[]
    ).map((item) => {
        if ((!item.longitude || !item.latitude) && item.easting && item.northing) {
            const osPoint = new OsPoint(item.northing, item.easting);

            const wgs84 = osPoint?.toWGS84();

            if (wgs84) {
                return {
                    ...item,
                    longitude: wgs84.longitude,
                    latitude: wgs84.latitude,
                };
            }
        }

        return {
            ...item,
        };
    });
};

const getAndParseNaptanFile = async (bucketName: string, filepath: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: filepath,
    });

    const body = (await file.Body?.transformToString()) || "";
    return parseXml(body);
};

const insertNaptanData = async (dbClient: KyselyDb, naptanStops: unknown[], naptanStopAreas: unknown[]) => {
    const numStopAreaRows = naptanStopAreas.length;
    const stopAreaBatches = [];

    while (naptanStopAreas.length > 0) {
        const chunk = naptanStopAreas.splice(0, 1000);
        stopAreaBatches.push(chunk);
    }

    logger.info(
        `Uploading ${numStopAreaRows} rows to the naptan_stop_area_new table in ${stopAreaBatches.length} batches`,
    );

    await BluebirdPromise.map(
        stopAreaBatches,
        (batch) => {
            return dbClient
                .insertInto("naptan_stop_area_new")
                .values(batch as NaptanStopArea[])
                .onConflict((oc) => oc.doNothing())
                .execute()
                .then(() => 0);
        },
        {
            concurrency: 50,
        },
    );

    const numStopRows = naptanStops.length;
    const stopBatches = [];

    while (naptanStops.length > 0) {
        const chunk = naptanStops.splice(0, 1000);
        stopBatches.push(chunk);
    }

    logger.info(`Uploading ${numStopRows} rows to the naptan_stop_new table in ${stopBatches.length} batches`);

    await BluebirdPromise.map(
        stopBatches,
        (batch) => {
            return dbClient
                .insertInto("naptan_stop_new")
                .values(batch as NaptanStop[])
                .execute()
                .then(() => 0);
        },
        {
            concurrency: 50,
        },
    );
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        const bucketName = event.Records[0].s3.bucket.name;

        logger.info("Starting naptan uploader");

        const { stopPoints: stopPoints1, stopAreas: stopAreas1 } = await getAndParseNaptanFile(
            bucketName,
            "AreaBatch1.xml",
        );

        const { stopPoints: stopPoints2, stopAreas: stopAreas2 } = await getAndParseNaptanFile(
            bucketName,
            "AreaBatch2.xml",
        );

        const stopPoints = [...stopPoints1, ...stopPoints2];
        const stopAreas = [...stopAreas1, ...stopAreas2];

        const naptanStopsWithLonsAndLats = addLonAndLatData(stopPoints);
        const naptanStopAreasWithLonsAndLats = addLonAndLatData(stopAreas);

        await insertNaptanData(dbClient, naptanStopsWithLonsAndLats, naptanStopAreasWithLonsAndLats);

        logger.info("Naptan uploader successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the naptan uploader");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
