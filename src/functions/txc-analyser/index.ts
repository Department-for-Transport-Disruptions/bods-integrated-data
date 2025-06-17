import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { DynamoDbObservation, NaptanStopMap, Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import { Handler } from "aws-lambda";
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
import { getAndParseTxcData, getNaptanStopData } from "./utils";

z.setErrorMap(errorMapWithDataLogging);

let naptanStopMap: NaptanStopMap;

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const { TXC_OBSERVATION_TABLE_NAME, NAPTAN_BUCKET_NAME, NPTG_BUCKET_NAME, GENERATE_ADVISORY_OBSERVATION_DETAIL } =
        process.env;

    if (!TXC_OBSERVATION_TABLE_NAME || !NAPTAN_BUCKET_NAME || !NPTG_BUCKET_NAME) {
        throw new Error(
            "Missing env vars - TXC_OBSERVATION_TABLE_NAME, NAPTAN_BUCKET_NAME and NPTG_BUCKET_NAME must be set.",
        );
    }

    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
    const filename = record.s3.object.key;
    const dataSource = bucketName.includes("-bods-") ? "bods" : bucketName.includes("-tnds-") ? "tnds" : "unknown";

    if (!filename.endsWith(".xml")) {
        logger.info("Ignoring non-xml file");
        return;
    }

    const txcData = await getAndParseTxcData(bucketName, filename);
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
        noc = operators[0].NationalOperatorCode || operators[0].OperatorCode || "unknown";
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
        await putDynamoItems(TXC_OBSERVATION_TABLE_NAME, dynamoDbObservations);
    }
};
