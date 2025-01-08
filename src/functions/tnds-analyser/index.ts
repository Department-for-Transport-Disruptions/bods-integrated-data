import { txcArrayProperties } from "@bods-integrated-data/shared/constants";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { PartialDeep } from "type-fest";
import { z } from "zod";
import checkFirstStopAndLastStopActivities from "./checks/checkFirstStopAndLastStopActivities";
import checkForDuplicateJourneyCodes from "./checks/checkForDuplicateJourneyCodes";
import checkForMissingBusWorkingNumber from "./checks/checkForMissingBusWorkingNumber";
import checkForMissingJourneyCodes from "./checks/checkForMissingJourneyCodes";
import checkForServicedOrganisationOutOfDate from "./checks/checkForServicedOrganisationOutOfDate";

z.setErrorMap(errorMapWithDataLogging);

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

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_ANALYSIS_TABLE_NAME: tndsAnalysisTableName } = process.env;

    if (!tndsAnalysisTableName) {
        throw new Error("Missing env vars - TNDS_ANALYSIS_TABLE_NAME must be set");
    }

    const record = event.Records[0];
    const filename = record.s3.object.key;

    if (!filename.endsWith(".xml")) {
        logger.info("Ignoring non-xml file");
        return;
    }

    const txcData = await getAndParseTxcData(record.s3.bucket.name, filename);

    const missingJourneyCodeObservations = checkForMissingJourneyCodes(filename, txcData);
    const duplicateJourneyCodeObservations = checkForDuplicateJourneyCodes(filename, txcData);
    const missingBusWorkingNumberObservations = checkForMissingBusWorkingNumber(filename, txcData);
    const servicedOrganisationsOutOfDateObservations = checkForServicedOrganisationOutOfDate(filename, txcData);
    const firstStopAndLastStopActivitiesObservations = checkFirstStopAndLastStopActivities(filename, txcData);

    const observations: Observation[] = [
        ...missingJourneyCodeObservations,
        ...duplicateJourneyCodeObservations,
        ...missingBusWorkingNumberObservations,
        ...servicedOrganisationsOutOfDateObservations,
        ...firstStopAndLastStopActivitiesObservations,
    ];

    if (observations.length) {
        await putDynamoItems(tndsAnalysisTableName, observations);
    }
};
