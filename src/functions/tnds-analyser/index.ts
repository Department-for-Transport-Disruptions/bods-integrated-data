import { txcArrayProperties } from "@bods-integrated-data/shared/constants";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { txcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
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

    const parsedTxc = parser.parse(xml) as Record<string, unknown>;

    const txcJson = txcSchema.deepPartial().safeParse(parsedTxc);

    if (!txcJson.success) {
        const validationError = fromZodError(txcJson.error);
        logger.error(validationError.toString());

        throw validationError;
    }

    return txcJson.data;
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_ANALYSIS_TABLE_NAME: tndsAnalysisTableName } = process.env;

    if (!tndsAnalysisTableName) {
        throw new Error("Missing env vars - TNDS_ANALYSIS_TABLE_NAME must be set");
    }

    const record = event.Records[0];
    const filename = record.s3.object.key;
    const txcData = await getAndParseTxcData(record.s3.bucket.name, filename);

    const missingJourneyCodeObservations = checkForMissingJourneyCodes(filename, txcData);
    const duplicateJourneyCodeObservations = checkForDuplicateJourneyCodes(filename, txcData);
    const missingBusWorkingNumberObservations = checkForMissingBusWorkingNumber(filename, txcData);
    const servicedOrganisationsOutOfDateObservations = checkForServicedOrganisationOutOfDate(filename, txcData);

    const observations: Observation[] = [
        ...missingJourneyCodeObservations,
        ...duplicateJourneyCodeObservations,
        ...missingBusWorkingNumberObservations,
        ...servicedOrganisationsOutOfDateObservations,
    ];

    if (observations.length) {
        await putDynamoItems(tndsAnalysisTableName, observations);
    }
};
