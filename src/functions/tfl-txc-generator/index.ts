import { KyselyDb, TflTxcMetadata, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { Handler } from "aws-lambda";
import { XMLBuilder } from "fast-xml-parser";
import { z } from "zod";
import { TflIBusData, getTflIBusData, upsertTxcMetadata } from "./data/db";
import { generateOperators } from "./data/operators";
import { generateRouteSections, generateRoutes } from "./data/routes";
import { generateJourneyPatternSections, generateServices } from "./data/services";
import { generateStopPoints } from "./data/stop-points";
import { generateVehicleJourneys } from "./data/vehicle-journeys";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const xmlBuilder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    attributeNamePrefix: "@_",
    suppressEmptyNode: true,
});

const getTxcAttributes = (metadata: TflTxcMetadata, lineId: string) => ({
    "?xml": {
        "@_version": "1.0",
        "@_encoding": "utf-8",
    },
    TransXChange: {
        "@_xmlns": "http://www.transxchange.org.uk/",
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "@_CreationDateTime": getDate(metadata.creation_datetime).toISOString(),
        "@_ModificationDateTime": metadata.modification_datetime
            ? getDate(metadata.modification_datetime).toISOString()
            : getDate(metadata.creation_datetime).toISOString(),
        "@_Modification": metadata.modification_datetime ? "revise" : "new",
        "@_RevisionNumber": metadata.revision.toString(),
        "@_FileName": `${lineId}.xml`,
        "@_SchemaVersion": "2.4",
        "@_RegistrationDocument": "false",
        "@_xsi:schemaLocation":
            "http://www.transxchange.org.uk/ http://www.transxchange.org.uk/schema/2.4/TransXChange_general.xsd",
    },
});

const buildTxc = async (iBusData: TflIBusData, metadata: TflTxcMetadata) => {
    const filteredPatterns = iBusData.patterns.filter(
        (pattern) => pattern.journeys.length > 0 && pattern.stops.length > 0,
    );

    const txcAttributes = getTxcAttributes(metadata, iBusData.id);

    const txc = {
        ...txcAttributes,
        TransXChange: {
            ...txcAttributes.TransXChange,
            StopPoints: generateStopPoints(filteredPatterns),
            RouteSections: generateRouteSections(filteredPatterns),
            Routes: generateRoutes(filteredPatterns),
            JourneyPatternSections: generateJourneyPatternSections(filteredPatterns),
            Operators: generateOperators(),
            Services: generateServices(filteredPatterns, iBusData.id),
            VehicleJourneys: await generateVehicleJourneys(filteredPatterns, iBusData.id),
        },
    };

    return xmlBuilder.build(txc);
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TFL_TXC_BUCKET_NAME: tflTxcBucketName, STAGE: stage } = process.env;

    if (!tflTxcBucketName) {
        throw new Error("Missing env var - TFL_TXC_BUCKET_NAME must be set");
    }

    dbClient = dbClient || (await getDatabaseClient(stage === "local"));

    const { lineId } = event;

    const parsedLineId = z.coerce.string().parse(lineId);

    try {
        logger.info(`Generating TxC for line: ${parsedLineId}`);

        const metadata = await upsertTxcMetadata(dbClient, parsedLineId);
        const iBusData = await getTflIBusData(dbClient, parsedLineId);
        const txc = await buildTxc(iBusData, metadata);

        await putS3Object({
            Bucket: tflTxcBucketName,
            Key: `${parsedLineId}.xml`,
            Body: txc,
        });

        logger.info(`TxC generated for line: ${parsedLineId}`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, `Error generating TxC for line: ${parsedLineId}`);
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
