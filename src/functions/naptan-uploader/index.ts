import { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import {
    KyselyDb,
    NaptanStop,
    NaptanStopArea,
    NewNaptanStop,
    NewNaptanStopArea,
    getDatabaseClient,
} from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { S3Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import OsPoint from "ospoint";
import xmlFlow from "xml-flow";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

// cross-account S3 for Naptan update
const getCrossAccountS3Client = async (roleArn: string, region: string) => {
    const stsClient = new STSClient({ region });

    const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: "naptan-uploader-cross-account-session",
        DurationSeconds: 3600,
    });

    const credentials = await stsClient.send(assumeRoleCommand);
    const assumedRoleCredentials = credentials.Credentials;

    if (
        !assumedRoleCredentials?.AccessKeyId ||
        !assumedRoleCredentials.SecretAccessKey ||
        !assumedRoleCredentials.SessionToken
    ) {
        throw new Error("Failed to assume role for cross-account S3 access");
    }

    return new S3Client({
        region,
        credentials: {
            accessKeyId: assumedRoleCredentials.AccessKeyId,
            secretAccessKey: assumedRoleCredentials.SecretAccessKey,
            sessionToken: assumedRoleCredentials.SessionToken,
        },
    });
};

const streamAndParseNaptanFile = async (
    bucketName: string,
    s3Key: string,
    crossAccountRoleArn: string,
    region: string,
): Promise<{ stopPoints: NewNaptanStop[]; stopAreas: NewNaptanStopArea[] }> => {
    const s3Client = await getCrossAccountS3Client(crossAccountRoleArn, region);
    const file = await getS3Object(
        {
            Bucket: bucketName,
            Key: s3Key,
        },
        s3Client,
    );

    if (!file.Body) {
        throw new Error(`No body returned for s3://${bucketName}/${s3Key}`);
    }

    return streamAndParseXml(file.Body as Readable);
};

export const streamAndParseXml = async (
    readable: Readable,
): Promise<{ stopPoints: NewNaptanStop[]; stopAreas: NewNaptanStopArea[] }> => {
    const stopPoints: NewNaptanStop[] = [];
    const stopAreas: NewNaptanStopArea[] = [];

    // Helper to extract test from xml-flow
    const getText = (node: any): string | null => {
        if (node == null) return null;
        if (Array.isArray(node)) return getText(node[0]);
        if (typeof node === "string") return node;
        if (typeof node === "number" || typeof node === "boolean") return String(node);
        if (node.$text != null) return String(node.$text);
        if (node._ != null) return String(node._);
        return null;
    };

    await new Promise<void>((resolve, reject) => {
        const stream = xmlFlow(readable, { strict: true, preserveMarkup: xmlFlow.NEVER, trim: true });

        // biome-ignore lint/suspicious/noExplicitAny: xml-flow has no TypeScript types
        stream.on("tag:StopPoint", (stop: any) => {
            const rawRefs = [].concat(stop.StopAreas?.StopAreaRef ?? stop.StopAreas ?? [])
            const refs: string[] = rawRefs.map((ref: any) => getText(ref)).filter((ref): ref is string => ref !== null);
            const atcoCode = getText(stop.AtcoCode);
            const locRaw = stop.Place?.Location;
            const loc = Array.isArray(locRaw) ? locRaw[0] : locRaw;
            const translationRaw = loc?.Translation;
            const translation = Array.isArray(translationRaw) ? translationRaw[0] : translationRaw;
            stopPoints.push({
                atco_code: atcoCode?.toUpperCase() ?? null,
                naptan_code: getText(stop.NaptanCode) ?? null,
                plate_code: getText(stop.PlateCode) ?? null,
                cleardown_code: getText(stop.CleardownCode) ?? null,
                common_name: getText(stop.Descriptor?.CommonName) ?? null,
                short_common_name: getText(stop.Descriptor?.ShortCommonName) ?? null,
                landmark: getText(stop.Descriptor?.Landmark) ?? null,
                street: getText(stop.Descriptor?.Street) ?? null,
                crossing: getText(stop.Descriptor?.Crossing) ?? null,
                indicator: getText(stop.Descriptor?.Indicator) ?? null,
                bearing:
                    getText(stop.StopClassification?.OnStreet?.MarkedPoint?.Bearing?.CompassPoint) ??
                    getText(stop.StopClassification?.OnStreet?.MarkedPoint?.Bearing) ??
                    getText(stop.StopClassification?.OnStreet?.MarkedPoint?.CompassPoint) ??
                    getText(stop.StopClassification?.OnStreet?.MarkedPoint) ??
                    getText(stop.StopClassification?.OnStreet?.UnmarkedPoint?.Bearing?.CompassPoint) ??
                    getText(stop.StopClassification?.OnStreet?.UnmarkedPoint?.Bearing) ??
                    getText(stop.StopClassification?.OnStreet?.UnmarkedPoint?.CompassPoint) ??
                    getText(stop.StopClassification?.OnStreet?.UnmarkedPoint) ??
                    null,
                nptg_locality_code: getText(stop.Place?.NptgLocalityRef) ?? null,
                locality_name: getText(stop.Place?.LocalityName) ?? null,
                town: getText(stop.Place?.Town) ?? null,
                suburb: getText(stop.Place?.Suburb) ?? null,
                locality_centre: getText(stop.Place?.LocalityCentre) ?? null,
                grid_type:
                    getText(loc?.GridType) ??
                    getText(translation?.GridType) ??
                    (typeof translation === "string" ? translation : null),
                easting: getText(translation?.Easting) || getText(loc?.Easting) || null,
                northing: getText(translation?.Northing) || getText(loc?.Northing) || null,
                longitude: getText(translation?.Longitude) || getText(loc?.Longitude) || null,
                latitude: getText(translation?.Latitude) || getText(loc?.Latitude) || null,
                stop_type: getText(stop.StopClassification?.StopType) ?? null,
                bus_stop_type: getText(stop.StopClassification?.OnStreet?.BusStopType) ?? null,
                timing_status:
                    getText(stop.StopClassification?.OnStreet?.TimingStatus) ??
                    getText(stop.StopClassification?.OffStreet?.BusAndCoach?.Bay?.TimingStatus) ??
                    getText(stop.StopClassification?.OffStreet?.BusAndCoach?.VariableBay?.TimingStatus) ??
                    null,
                default_wait_time: getText(stop.StopClassification?.OnStreet?.MarkedPoint?.DefaultWaitTime) ?? null,
                notes: getText(stop.StopFurtherDetails?.Notes) ?? null,
                administrative_area_code: getText(stop.AdministrativeAreaRef) ?? null,
                creation_date_time: null,
                modification_date_time: null,
                revision_number: null,
                modification: null,
                status: null,
                stop_area_code: refs.length === 1 ? refs[0].toUpperCase() : null,
            });
        });

        // biome-ignore lint/suspicious/noExplicitAny: xml-flow has no TypeScript types
        stream.on("tag:StopArea", (stopArea: any) => {
        const stopAreaCode = getText(stopArea.StopAreaCode);
        const areaLocRaw = stopArea.Location;
        const areaLoc = Array.isArray(areaLocRaw) ? areaLocRaw[0] : areaLocRaw;
        const areaTranslationRaw = areaLoc?.Translation;
        const areaTranslation = Array.isArray(areaTranslationRaw) ? areaTranslationRaw[0] : areaTranslationRaw;
        stopAreas.push({
            stop_area_code: stopAreaCode?.toUpperCase() ?? null,
            name: getText(stopArea.Name) ?? null,
            administrative_area_code: getText(stopArea.AdministrativeAreaRef) ?? null,
            stop_area_type: getText(stopArea.StopAreaType) ?? null,
            grid_type:
                getText(areaLoc?.GridType) ??
                getText(areaTranslation?.GridType) ??
                (typeof areaTranslation === "string" ? areaTranslation : null),
            easting: getText(areaTranslation?.Easting) ?? getText(areaLoc?.Easting) ?? null,
            northing: getText(areaTranslation?.Northing) ?? getText(areaLoc?.Northing) ?? null,
            longitude: getText(areaTranslation?.Longitude) ?? getText(areaLoc?.Longitude) ?? null,
            latitude: getText(areaTranslation?.Latitude) ?? getText(areaLoc?.Latitude) ?? null,
        });
    });

        stream.on("error", reject);
        stream.on("end", resolve);
    });

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
        const externalBucketName = process.env.NAPTAN_BUCKET;
        const crossAccountRoleArn = process.env.NAPTAN_ROLE_ARN;
        const bucketRegion = process.env.BUCKET_REGION;

        if (!externalBucketName) {
            throw new Error("NAPTAN_BUCKET environment variable must be set");
        }

        if (!crossAccountRoleArn) {
            throw new Error("NAPTAN_ROLE_ARN environment variable must be set");
        }

        if (!bucketRegion) {
            throw new Error("BUCKET_REGION environment variable must be set");
        }

        logger.info("Starting naptan uploader");

        const naptanS3Key = process.env.NAPTAN_S3_KEY;

        if (!naptanS3Key) {
            throw new Error("NAPTAN_S3_KEY environment variable must be set");
        }

        const { stopPoints, stopAreas } = await streamAndParseNaptanFile(
            externalBucketName,
            naptanS3Key,
            crossAccountRoleArn,
            bucketRegion,
        );

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
