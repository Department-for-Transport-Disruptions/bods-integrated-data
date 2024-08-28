import { Stream } from "node:stream";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { getS3Object, putS3Object } from "@bods-integrated-data/shared/s3";
import { Handler } from "aws-lambda";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { Entry, Parse } from "unzipper";

interface TotalOfOperators {
    [key: string]: number;
}

interface OperatorDifference {
    oldCount: number;
    newCount: number;
    absoluteDifference: number;
    percentageDifference: number;
}

interface OperatorComparison {
    [key: string]: OperatorDifference;
}

const arrayProperties = ["VehicleActivity", "OnwardCall"];

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    return parser.parse(xml) as Record<string, unknown>;
};

export const getTotalSiri = async (bucketName: string) => {
    const data = await getS3Object({
        Bucket: bucketName,
        Key: "SIRI-VM.xml",
    });

    const body = data.Body;

    if (body) {
        const xml = await body.transformToString();
        return getTotalVehicleActivites(xml);
    }

    return {};
};

export const getTotalBods = async (): Promise<TotalOfOperators> => {
    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/avl/download/bulk_archive", {
        responseType: "stream",
    });

    const zip = response.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    for await (const item of zip) {
        const entry = item as Entry;

        if (entry.type === "File") {
            return getTotalVehicleActivites((await entry.buffer()).toString());
        }
    }

    return {};
};

export const getTotalVehicleActivites = (unparsedSiri: string) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const siri = parseXml(unparsedSiri) as any;

    const vehicleActivities = siri.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity as {
        MonitoredVehicleJourney: {
            OperatorRef: string;
        };
    }[];

    return vehicleActivities.reduce((acc: TotalOfOperators, { MonitoredVehicleJourney: { OperatorRef } }) => {
        acc[OperatorRef] = (acc[OperatorRef] || 0) + 1;
        return acc;
    }, {});
};

export const calculateItemsAndUploadToS3 = async (
    totalBods: TotalOfOperators,
    totalSiri: TotalOfOperators,
    bucket: string,
) => {
    const result: OperatorComparison = {};

    for (const key of Object.keys(totalBods)) {
        const bodsCount = totalBods[key] ?? 0;
        const siriCount = totalSiri[key] ?? 0;

        const absoluteDifference = Math.abs(bodsCount - siriCount);

        const percentageDifference =
            bodsCount !== 0 ? (absoluteDifference / bodsCount) * 100 : siriCount !== 0 ? 100 : 0;

        result[key] = {
            oldCount: bodsCount,
            newCount: siriCount,
            absoluteDifference: absoluteDifference,
            percentageDifference: percentageDifference,
        };
    }

    await putS3Object({
        Bucket: bucket,
        Key: getDate().toISOString(),
        ContentType: "application/json",
        Body: JSON.stringify(result),
    });
};

export const handler: Handler = async () => {
    const { SIRI_VM_BUCKET_NAME: siriVmBucket, ANALYSIS_BUCKET_NAME: analysisBucket } = process.env;

    if (!siriVmBucket || !analysisBucket) {
        throw new Error("Missing env vars: SIRI_VM_BUCKET_NAME and ANALYSIS_BUCKET_NAME must be set.");
    }

    try {
        const totalBods = await getTotalBods();
        const totalSiri = await getTotalSiri(siriVmBucket);

        await calculateItemsAndUploadToS3(totalBods, totalSiri, analysisBucket);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("BODS - Siri VM analysis has failed", e);
        }

        throw e;
    }
};
