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
import sax from "sax";
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

interface XmlNode {
    name: string;
    attributes: Record<string, string>;
    children: XmlNode[];
    text: string;
}

const getChild = (node: XmlNode | undefined, name: string): XmlNode | undefined =>
    node?.children.find((child) => child.name === name);

const getChildren = (node: XmlNode | undefined, name: string): XmlNode[] =>
    node?.children.filter((child) => child.name === name) ?? [];

const getPath = (node: XmlNode | undefined, ...names: string[]): XmlNode | undefined =>
    names.reduce<XmlNode | undefined>((current, name) => getChild(current, name), node);

const getText = (node: XmlNode | undefined): string | null => {
    const trimmed = node?.text.trim();
    return trimmed ? trimmed : null;
};

const mapStopPoint = (stop: XmlNode): NewNaptanStop => {
    const descriptor = getChild(stop, "Descriptor");
    const place = getChild(stop, "Place");
    const location = getChild(place, "Location");
    const translation = getChild(location, "Translation");
    const classification = getChild(stop, "StopClassification");
    const onStreet = getChild(classification, "OnStreet");
    const bus = getChild(onStreet, "Bus");
    const markedPoint = getChild(bus, "MarkedPoint");
    const refs = getChildren(getChild(stop, "StopAreas"), "StopAreaRef")
        .map(getText)
        .filter((ref): ref is string => ref !== null);
    const atcoCode = getText(getChild(stop, "AtcoCode"));

    if (!atcoCode) {
        throw new Error("StopPoint missing AtcoCode");
    }

    return {
        atco_code: atcoCode.toUpperCase(),
        naptan_code: getText(getChild(stop, "NaptanCode")),
        plate_code: getText(getChild(stop, "PlateCode")),
        cleardown_code: getText(getChild(stop, "CleardownCode")),
        common_name: getText(getChild(descriptor, "CommonName")),
        short_common_name: getText(getChild(descriptor, "ShortCommonName")),
        landmark: getText(getChild(descriptor, "Landmark")),
        street: getText(getChild(descriptor, "Street")),
        crossing: getText(getChild(descriptor, "Crossing")),
        indicator: getText(getChild(descriptor, "Indicator")),
        bearing:
            getText(getPath(markedPoint, "Bearing", "CompassPoint")) ??
            getText(getPath(bus, "UnmarkedPoint", "Bearing", "CompassPoint")),
        nptg_locality_code: getText(getChild(place, "NptgLocalityRef")),
        locality_name: getText(getChild(place, "LocalityName")),
        town: getText(getChild(place, "Town")),
        suburb: getText(getChild(place, "Suburb")),
        locality_centre: getText(getChild(place, "LocalityCentre")),
        grid_type: getText(getChild(translation, "GridType")) ?? getText(getChild(location, "GridType")),
        easting: getText(getChild(translation, "Easting")) ?? getText(getChild(location, "Easting")),
        northing: getText(getChild(translation, "Northing")) ?? getText(getChild(location, "Northing")),
        longitude: getText(getChild(translation, "Longitude")) ?? getText(getChild(location, "Longitude")),
        latitude: getText(getChild(translation, "Latitude")) ?? getText(getChild(location, "Latitude")),
        stop_type: getText(getChild(classification, "StopType")),
        bus_stop_type: getText(getChild(bus, "BusStopType")),
        timing_status:
            getText(getChild(bus, "TimingStatus")) ??
            getText(getPath(classification, "OffStreet", "BusAndCoach", "Bay", "TimingStatus")) ??
            getText(getPath(classification, "OffStreet", "BusAndCoach", "VariableBay", "TimingStatus")),
        default_wait_time: getText(getChild(markedPoint, "DefaultWaitTime")),
        notes: getText(getPath(stop, "StopFurtherDetails", "Notes")),
        administrative_area_code: getText(getChild(stop, "AdministrativeAreaRef")),
        creation_date_time: null,
        modification_date_time: null,
        revision_number: null,
        modification: null,
        status: null,
        stop_area_code: refs.length === 1 ? refs[0].toUpperCase() : null,
    };
};

const mapStopArea = (stopArea: XmlNode): NewNaptanStopArea => {
    const location = getChild(stopArea, "Location");
    const translation = getChild(location, "Translation");
    const stopAreaCode = getText(getChild(stopArea, "StopAreaCode"));

    if (!stopAreaCode) {
        throw new Error("StopArea missing StopAreaCode");
    }

    const name = getText(getChild(stopArea, "Name"));

    if (!name) {
        throw new Error("StopArea missing Name");
    }

    const administrativeAreaCode = getText(getChild(stopArea, "AdministrativeAreaRef"));

    if (!administrativeAreaCode) {
        throw new Error("StopArea missing AdministrativeAreaRef");
    }

    const stopAreaType = getText(getChild(stopArea, "StopAreaType"));

    if (!stopAreaType) {
        throw new Error("StopArea missing StopAreaType");
    }

    return {
        stop_area_code: stopAreaCode.toUpperCase(),
        name,
        administrative_area_code: administrativeAreaCode,
        stop_area_type: stopAreaType,
        grid_type: getText(getChild(translation, "GridType")) ?? getText(getChild(location, "GridType")),
        easting: getText(getChild(translation, "Easting")) ?? getText(getChild(location, "Easting")),
        northing: getText(getChild(translation, "Northing")) ?? getText(getChild(location, "Northing")),
        longitude: getText(getChild(translation, "Longitude")) ?? getText(getChild(location, "Longitude")),
        latitude: getText(getChild(translation, "Latitude")) ?? getText(getChild(location, "Latitude")),
    };
};

export const streamAndParseXml = async (
    readable: Readable,
): Promise<{ stopPoints: NewNaptanStop[]; stopAreas: NewNaptanStopArea[] }> => {
    return new Promise((resolve, reject) => {
        const stopPoints: NewNaptanStop[] = [];
        const stopAreas: NewNaptanStopArea[] = [];

        const saxStream = sax.createStream(true, { trim: true });
        const stack: XmlNode[] = [];
        let capturing: "StopPoint" | "StopArea" | null = null;

        saxStream.on("opentag", (tag) => {
            if (!capturing) {
                if (tag.name === "StopPoint") {
                    capturing = "StopPoint";
                } else if (tag.name === "StopArea") {
                    capturing = "StopArea";
                } else {
                    return;
                }
            }

            const node: XmlNode = {
                name: tag.name,
                attributes: tag.attributes as Record<string, string>,
                children: [],
                text: "",
            };

            stack[stack.length - 1]?.children.push(node);
            stack.push(node);
        });

        saxStream.on("text", (text) => {
            const current = stack[stack.length - 1];
            if (current) {
                current.text += text;
            }
        });

        saxStream.on("closetag", (_tagName) => {
            if (!capturing) {
                return;
            }

            const node = stack.pop();

            if (stack.length === 0 && node) {
                if (capturing === "StopPoint") {
                    stopPoints.push(mapStopPoint(node));
                } else {
                    stopAreas.push(mapStopArea(node));
                }
                capturing = null;
            }
        });

        saxStream.on("error", reject);
        saxStream.on("end", () => resolve({ stopPoints, stopAreas }));

        readable.pipe(saxStream);
    });
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

    const dedupedStops = Array.from(
        new Map((naptanStops as NaptanStop[]).map((stop) => [stop.atco_code, stop])).values(),
    );

    const numStopRows = dedupedStops.length;
    const stopBatches = [];

    while (dedupedStops.length > 0) {
        const chunk = dedupedStops.splice(0, 1000);
        stopBatches.push(chunk);
    }

    logger.info(`Uploading ${numStopRows} rows to the naptan_stop_new table in ${stopBatches.length} batches`);

    await BluebirdPromise.map(
        stopBatches,
        (batch) => {
            return dbClient
                .insertInto("naptan_stop_new")
                .values(batch as NaptanStop[])
                .onConflict((oc) => oc.column("atco_code").doNothing())
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
