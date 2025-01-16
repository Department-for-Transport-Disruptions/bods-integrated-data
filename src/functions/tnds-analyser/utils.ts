import { nptgArrayProperties, txcArrayProperties } from "@bods-integrated-data/shared/constants";
import { NaptanStop } from "@bods-integrated-data/shared/database";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { NptgSchema, TxcSchema } from "@bods-integrated-data/shared/schema";
import { NaptanStopMap } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { XMLParser } from "fast-xml-parser";
import { parse } from "papaparse";
import { PartialDeep } from "type-fest";

export const getAndParseTxcData = async (bucketName: string, objectKey: string) => {
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

export const getNaptanStopData = async (nptgBucketName: string, naptanBucketName: string) => {
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
            isArray: (tagName) => nptgArrayProperties.includes(tagName),
        });

        const nptgData = xmlParser.parse(nptgXml) as PartialDeep<NptgSchema>;
        const nptgRegions = nptgData.NationalPublicTransportGazetteer?.Regions?.Region;

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
