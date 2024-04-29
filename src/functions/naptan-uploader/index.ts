import { logger } from "@baselime/lambda-logger";
import { Database, NaptanStop, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { S3Event } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import { Kysely } from "kysely";
import OsPoint from "ospoint";
import { parse } from "papaparse";

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

const getAndParseNaptanFile = async (event: S3Event) => {
    const { object, bucket } = event.Records[0].s3;

    const file = await getS3Object({
        Bucket: bucket.name,
        Key: object.key,
    });

    const body = (await file.Body?.transformToString()) || "";

    const { data } = parse(body, {
        skipEmptyLines: "greedy",
        header: true,
        transformHeader: (header) => {
            const headerMap: Record<string, string> = {
                ATCOCode: "atco_code",
                NaptanCode: "naptan_code",
                PlateCode: "plate_code",
                CleardownCode: "cleardown_code",
                CommonName: "common_name",
                CommonNameLang: "common_name_lang",
                ShortCommonName: "short_common_name",
                ShortCommonNameLang: "short_common_name_lang",
                Landmark: "landmark",
                LandmarkLang: "landmark_lang",
                Street: "street",
                StreetLang: "street_lang",
                Crossing: "crossing",
                CrossingLang: "crossing_lang",
                Indicator: "indicator",
                IndicatorLang: "indicator_lang",
                Bearing: "bearing",
                NptgLocalityCode: "nptg_locality_code",
                LocalityName: "locality_name",
                ParentLocalityName: "parent_locality_name",
                GrandParentLocalityName: "grand_parent_locality_name",
                Town: "town",
                TownLang: "town_lang",
                Suburb: "suburb",
                SuburbLang: "suburb_lang",
                LocalityCentre: "locality_centre",
                GridType: "grid_type",
                Easting: "easting",
                Northing: "northing",
                Longitude: "longitude",
                Latitude: "latitude",
                StopType: "stop_type",
                BusStopType: "bus_stop_type",
                TimingStatus: "timing_status",
                DefaultWaitTime: "default_wait_time",
                Notes: "notes",
                NotesLang: "notes_lang",
                AdministrativeAreaCode: "administrative_area_code",
                CreationDateTime: "creation_date_time",
                ModificationDateTime: "modification_date_time",
                RevisionNumber: "revision_number",
                Modification: "modification",
                Status: "status",
            };

            return headerMap[header];
        },
    });

    return data;
};

const insertNaptanData = async (dbClient: Kysely<Database>, naptanData: unknown[]) => {
    const numRows = naptanData.length;
    const batches = [];

    while (naptanData.length > 0) {
        const chunk = naptanData.splice(0, 1000);
        batches.push(chunk);
    }

    logger.info(`Uploading ${numRows} rows to the database in ${batches.length} batches`);

    await BluebirdPromise.map(
        batches,
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

export const handler = async (event: S3Event) => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info(`Starting naptan uploader`);

        const naptanData = await getAndParseNaptanFile(event);
        const naptanDataWithLonsAndLats = addLonAndLatData(naptanData);

        await insertNaptanData(dbClient, naptanDataWithLonsAndLats);

        logger.info("Naptan uploader successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the naptan uploader", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
