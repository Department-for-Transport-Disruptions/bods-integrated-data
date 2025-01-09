import { txcArrayProperties } from "@bods-integrated-data/shared/constants";
import { NaptanStop } from "@bods-integrated-data/shared/database";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { parse } from "papaparse";
import { PartialDeep } from "type-fest";
import { z } from "zod";
import checkFirstStopAndLastStopActivities from "./checks/checkFirstStopAndLastStopActivities";
import checkFirstStopAndLastStopTimingPoints from "./checks/checkFirstStopAndLastStopTimingPoints";
import checkForDuplicateJourneyCodes from "./checks/checkForDuplicateJourneyCodes";
import checkForMissingBusWorkingNumber from "./checks/checkForMissingBusWorkingNumber";
import checkForMissingJourneyCodes from "./checks/checkForMissingJourneyCodes";
import checkForServicedOrganisationOutOfDate from "./checks/checkForServicedOrganisationOutOfDate";
import checkStopsAgainstNaptan from "./checks/checkStopsAgainstNaptan";

z.setErrorMap(errorMapWithDataLogging);

let naptanStops: Record<string, string | null> = {};

const getAndParseTxcData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => txcArrayProperties.includes(tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new Error("No xml data");
    }

    return parser.parse(xml) as PartialDeep<TxcSchema>;
};

const getAndParseNaptanFile = async (naptanBucketName: string) => {
    const file = await getS3Object({
        Bucket: naptanBucketName,
        Key: "Stops.csv",
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
    }) as { data: NaptanStop[] };

    return data.reduce((acc: Record<string, string | null>, stop) => {
        acc[stop.atco_code] = stop.stop_type;
        return acc;
    }, {});
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_ANALYSIS_TABLE_NAME: tndsAnalysisTableName, NAPTAN_BUCKET_NAME: naptanBucketName } = process.env;

    if (!tndsAnalysisTableName || !naptanBucketName) {
        throw new Error("Missing env vars - TNDS_ANALYSIS_TABLE_NAME and NAPTAN_BUCKET_NAME must be set");
    }

    const record = event.Records[0];
    const filename = record.s3.object.key;

    if (!filename.endsWith(".xml")) {
        logger.info("Ignoring non-xml file");
        return;
    }

    const txcData = await getAndParseTxcData(record.s3.bucket.name, filename);

    naptanStops = naptanStops || (await getAndParseNaptanFile(naptanBucketName));

    const missingJourneyCodeObservations = checkForMissingJourneyCodes(filename, txcData);
    const duplicateJourneyCodeObservations = checkForDuplicateJourneyCodes(filename, txcData);
    const missingBusWorkingNumberObservations = checkForMissingBusWorkingNumber(filename, txcData);
    const servicedOrganisationsOutOfDateObservations = checkForServicedOrganisationOutOfDate(filename, txcData);
    const firstStopAndLastStopActivitiesObservations = checkFirstStopAndLastStopActivities(filename, txcData);
    const naptanStopCheckObservations = checkStopsAgainstNaptan(filename, txcData, naptanStops);
    const firstStopAndLastStopTimingPoints = checkFirstStopAndLastStopTimingPoints(filename, txcData);

    const observations: Observation[] = [
        ...missingJourneyCodeObservations,
        ...duplicateJourneyCodeObservations,
        ...missingBusWorkingNumberObservations,
        ...servicedOrganisationsOutOfDateObservations,
        ...naptanStopCheckObservations,
        ...firstStopAndLastStopActivitiesObservations,
        ...firstStopAndLastStopTimingPoints,
    ];

    if (observations.length) {
        await putDynamoItems(tndsAnalysisTableName, observations);
    }
};
