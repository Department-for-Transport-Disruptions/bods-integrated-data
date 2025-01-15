import { txcArrayProperties } from "@bods-integrated-data/shared/constants";
import { NaptanStop } from "@bods-integrated-data/shared/database";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { TxcSchema, nptgSchema } from "@bods-integrated-data/shared/schema";
import { DynamoDbObservation, NaptanStopMap, Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { parse } from "papaparse";
import { PartialDeep } from "type-fest";
import { z } from "zod";
import checkFirstStopAndLastStopActivities from "./checks/checkFirstStopAndLastStopActivities";
import checkFirstStopAndLastStopTimingPoints from "./checks/checkFirstStopAndLastStopTimingPoints";
import checkForDuplicateJourneyCodes from "./checks/checkForDuplicateJourneyCodes";
import checkForDuplicateJourneys from "./checks/checkForDuplicateJourneys";
import checkForMissingBusWorkingNumber from "./checks/checkForMissingBusWorkingNumber";
import checkForMissingJourneyCodes from "./checks/checkForMissingJourneyCodes";
import checkForNoTimingPointForThan15Minutes from "./checks/checkForNoTimingPointForThan15Minutes";
import checkForServicedOrganisationOutOfDate from "./checks/checkForServicedOrganisationOutOfDate";
import checkStopsAgainstNaptan from "./checks/checkStopsAgainstNaptan";

z.setErrorMap(errorMapWithDataLogging);

let naptanStopMap: NaptanStopMap;

const getAndParseTxcData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new Error("No xml data");
    }

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => txcArrayProperties.includes(tagName),
    });

    return parser.parse(xml) as PartialDeep<TxcSchema>;
};

const getNaptanStopData = async (nptgBucketName: string, naptanBucketName: string) => {
    const [nptgFile, naptanStopsFile] = await Promise.all([
        getS3Object({ Bucket: nptgBucketName, Key: "NPTG.xml" }),
        getS3Object({ Bucket: naptanBucketName, Key: "Stops.csv" }),
    ]);

    const [nptgXml, naptanCsv] = await Promise.all([
        nptgFile.Body?.transformToString(),
        naptanStopsFile.Body?.transformToString(),
    ]);

    const naptanStopMap: NaptanStopMap = {};
    const adminAreaCodes: Record<string, string[]> = {};

    if (nptgXml) {
        const xmlParser = new XMLParser({
            allowBooleanAttributes: true,
            ignoreAttributes: false,
            parseTagValue: false,
            isArray: (tagName) => ["AdministrativeArea", "NptgLocality", "Region"].includes(tagName),
        });

        const parsedXml = xmlParser.parse(nptgXml) as PartialDeep<TxcSchema>;
        const nptgData = nptgSchema.parse(parsedXml);
        const nptgRegions = nptgData.NationalPublicTransportGazetteer.Regions?.Region;

        if (nptgRegions) {
            for (const region of nptgRegions) {
                const adminAreas = region.AdministrativeAreas?.AdministrativeArea;

                if (adminAreas) {
                    for (const adminArea of adminAreas) {
                        const adminAreaCode = adminArea.AdministrativeAreaCode;

                        if (!adminAreaCodes[adminAreaCode]) {
                            adminAreaCodes[adminAreaCode] = [];
                        }

                        adminAreaCodes[adminAreaCode].push(region.RegionCode);
                    }
                }
            }
        }
    }

    if (naptanCsv) {
        const { data } = parse(naptanCsv, {
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

        for (const row of data) {
            const adminAreaCode = row.administrative_area_code;
            const regionCodes = adminAreaCode ? adminAreaCodes[adminAreaCode] : [];

            naptanStopMap[row.atco_code] = {
                stopType: row.stop_type || null,
                regions: regionCodes,
            };
        }
    }

    return naptanStopMap;
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_OBSERVATION_TABLE_NAME, NAPTAN_BUCKET_NAME, NPTG_BUCKET_NAME, GENERATE_ADVISORY_OBSERVATION_DETAIL } =
        process.env;

    if (!TNDS_OBSERVATION_TABLE_NAME || !NAPTAN_BUCKET_NAME || !NPTG_BUCKET_NAME) {
        throw new Error(
            "Missing env vars - TNDS_OBSERVATION_TABLE_NAME, NAPTAN_BUCKET_NAME and NPTG_BUCKET_NAME must be set",
        );
    }

    const record = event.Records[0];
    const filename = record.s3.object.key;
    const dataSource = record.s3.bucket.name.includes("-tnds-") ? "tnds" : "bods";

    if (!filename.endsWith(".xml")) {
        logger.info("Ignoring non-xml file");
        return;
    }

    const txcData = await getAndParseTxcData(record.s3.bucket.name, filename);
    naptanStopMap = naptanStopMap || (await getNaptanStopData(NPTG_BUCKET_NAME, NAPTAN_BUCKET_NAME));

    const observations: Observation[] = [
        ...checkForMissingJourneyCodes(txcData),
        ...checkForDuplicateJourneyCodes(txcData),
        ...checkForDuplicateJourneys(txcData),
        ...checkForMissingBusWorkingNumber(txcData),
        ...checkForServicedOrganisationOutOfDate(txcData),
        ...checkFirstStopAndLastStopActivities(txcData),
        ...checkStopsAgainstNaptan(txcData, naptanStopMap),
        ...checkFirstStopAndLastStopTimingPoints(txcData),
        ...checkForNoTimingPointForThan15Minutes(txcData),
    ];

    let noc = "unknown";
    let region = "unknown";

    const operators = txcData.TransXChange?.Operators?.Operator;

    if (operators) {
        noc = operators[0].OperatorCode || "unknown";
    }

    const stopPoints = txcData.TransXChange?.StopPoints?.AnnotatedStopPointRef;

    if (stopPoints) {
        const stopPointRef = naptanStopMap[stopPoints[0].StopPointRef];

        if (stopPointRef) {
            region = stopPointRef.regions.join(";");
        }
    }

    const dynamoDbObservations: DynamoDbObservation[] = observations.map((observation, i) => ({
        PK: filename,
        SK: i.toString(),
        noc: noc,
        region: region,
        dataSource: dataSource,
        ...observation,
        details: GENERATE_ADVISORY_OBSERVATION_DETAIL ? observation.details : undefined,
    }));

    if (observations.length) {
        await putDynamoItems(TNDS_OBSERVATION_TABLE_NAME, dynamoDbObservations);
    }
};
