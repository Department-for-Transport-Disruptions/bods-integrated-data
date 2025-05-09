import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { iBusArrayProperties, iBusSchema } from "@bods-integrated-data/shared/schema";
import { Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
    insertTflBlockCalendarDays,
    insertTflBlocks,
    insertTflDestinations,
    insertTflGarages,
    insertTflJourneyDriveTimes,
    insertTflJourneyWaitTimes,
    insertTflJourneys,
    insertTflLines,
    insertTflOperators,
    insertTflPatterns,
    insertTflRouteGeometries,
    insertTflStopInPatterns,
    insertTflStopPoints,
    insertTflVehicles,
} from "./database";
import {
    mapTflBlockCalendarDays,
    mapTflBlocks,
    mapTflDestinations,
    mapTflGarages,
    mapTflJourneyDriveTimes,
    mapTflJourneyWaitTimes,
    mapTflJourneys,
    mapTflLines,
    mapTflOperators,
    mapTflPatterns,
    mapTflRouteGeometries,
    mapTflStopInPatterns,
    mapTflStopPoints,
    mapTflVehicles,
} from "./transformations";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

export const getAndParseTflData = async (bucketName: string, objectKey: string) => {
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
        isArray: (tagName) => iBusArrayProperties.includes(tagName),
    });

    const xmlWithoutNilAttributes = xml.replace(/xsi:nil="true"/g, "");
    const parsedXml = parser.parse(xmlWithoutNilAttributes) as Record<string, unknown>;
    const tflJson = iBusSchema.safeParse(parsedXml);

    if (!tflJson.success) {
        const validationError = fromZodError(tflJson.error);
        logger.error(validationError.toString());

        throw validationError;
    }

    return tflJson.data;
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const objectKey = record.s3.object.key;

        if (!objectKey.endsWith(".xml")) {
            logger.info("Ignoring non-xml file");
            return;
        }

        logger.filepath = objectKey;
        const tflData = await getAndParseTflData(bucketName, objectKey);

        if (tflData["vh:Vehicle_Data"]) {
            const vehicles = mapTflVehicles(tflData["vh:Vehicle_Data"]);
            await insertTflVehicles(dbClient, vehicles);
        }

        if (tflData["op:Network_Data"]) {
            const operators = mapTflOperators(tflData["op:Network_Data"]);
            await insertTflOperators(dbClient, operators);
        }

        if (tflData["gar:Network_Data"]) {
            const garages = mapTflGarages(tflData["gar:Network_Data"]);
            await insertTflGarages(dbClient, garages);
        }

        if (tflData["bl:Schedule_Data"]) {
            const blocks = mapTflBlocks(tflData["bl:Schedule_Data"]);
            await insertTflBlocks(dbClient, blocks);
        }

        if (tflData["blcal:Schedule_Data"]) {
            const blockCalendarDays = mapTflBlockCalendarDays(tflData["blcal:Schedule_Data"]);
            await insertTflBlockCalendarDays(dbClient, blockCalendarDays);
        }

        if (tflData["sp:Network_Data"]) {
            const stopPoints = mapTflStopPoints(tflData["sp:Network_Data"]);
            await insertTflStopPoints(dbClient, stopPoints);
        }

        if (tflData["dst:Network_Data"]) {
            const destinations = mapTflDestinations(tflData["dst:Network_Data"]);
            await insertTflDestinations(dbClient, destinations);
        }

        if (tflData["rg:Network_Data"]) {
            const routeGeometries = mapTflRouteGeometries(tflData["rg:Network_Data"]);
            await insertTflRouteGeometries(dbClient, routeGeometries);
        }

        if (tflData["In:Network_Data"]) {
            const lines = mapTflLines(tflData["In:Network_Data"]);
            await insertTflLines(dbClient, lines);
        }

        if (tflData["pt:Network_Data"]) {
            const patterns = mapTflPatterns(tflData["pt:Network_Data"]);
            await insertTflPatterns(dbClient, patterns);
        }

        if (tflData["sipt:Network_Data"]) {
            const stopInPatterns = mapTflStopInPatterns(tflData["sipt:Network_Data"]);
            await insertTflStopInPatterns(dbClient, stopInPatterns);
        }

        if (tflData["jou:Schedule_Data"]) {
            const journeys = mapTflJourneys(tflData["jou:Schedule_Data"]);
            await insertTflJourneys(dbClient, journeys);
        }

        if (tflData["jouwt:Schedule_Data"]) {
            const journeyWaitTimes = mapTflJourneyWaitTimes(tflData["jouwt:Schedule_Data"]);
            await insertTflJourneyWaitTimes(dbClient, journeyWaitTimes);
        }

        if (tflData["joudt:Schedule_Data"]) {
            const journeyDriveTimes = mapTflJourneyDriveTimes(tflData["joudt:Schedule_Data"]);
            await insertTflJourneyDriveTimes(dbClient, journeyDriveTimes);
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the TfL timetable processor function");
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
