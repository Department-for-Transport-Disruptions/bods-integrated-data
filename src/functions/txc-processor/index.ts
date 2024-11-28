import { Agency, KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { BankHolidaysJson } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import {
    Operator,
    Service,
    ServicedOrganisation,
    TxcJourneyPatternSection,
    TxcRoute,
    TxcRouteSection,
    VehicleJourney,
    txcSchema,
} from "@bods-integrated-data/shared/schema";
import { S3EventRecord, S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { processAgencies } from "./data/agencies";
import { processCalendars } from "./data/calendar";
import { processFrequencies } from "./data/frequencies";
import { processRoutes } from "./data/routes";
import { processShapes } from "./data/shapes";
import { processStopTimes } from "./data/stopTimes";
import { processAnnotatedStopPointRefs, processStopPoints } from "./data/stops";
import { processTrips } from "./data/trips";
import { InvalidOperatorError } from "./errors";
import { VehicleJourneyMapping } from "./types";
import {
    getJourneyPatternForVehicleJourney,
    getNationalOperatorCode,
    hasServiceExpired,
    isRequiredTndsDataset,
    isRequiredTndsServiceMode,
} from "./utils";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const txcArrayProperties = [
    "ServicedOrganisation",
    "AnnotatedStopPointRef",
    "StopPoint",
    "RouteSectionRef",
    "RouteSection",
    "Route",
    "RouteLink",
    "JourneyPatternSection",
    "JourneyPatternSectionRefs",
    "Operator",
    "Garage",
    "Service",
    "Line",
    "Track",
    "JourneyPattern",
    "JourneyPatternTimingLink",
    "VehicleJourney",
    "VehicleJourneyTimingLink",
    "OtherPublicHoliday",
    "DateRange",
    "ServicedOrganisationRef",
];

const getBankHolidaysJson = async (bucket: string) => {
    const file = await getS3Object({
        Bucket: bucket,
        Key: "bank-holidays.json",
    });

    const body = await file.Body?.transformToString();

    if (!body) {
        throw new Error("No data found in bank-holidays.json");
    }

    return JSON.parse(body) as BankHolidaysJson;
};

const processServices = (
    dbClient: KyselyDb,
    bankHolidaysJson: BankHolidaysJson,
    operators: Operator[],
    services: Service[],
    vehicleJourneys: VehicleJourney[],
    txcRouteSections: TxcRouteSection[],
    txcRoutes: TxcRoute[],
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    agencyData: Agency[],
    filePath: string,
    isTnds: boolean,
    servicedOrganisations?: ServicedOrganisation[],
) => {
    const promises = services.flatMap(async (service) => {
        if (hasServiceExpired(service)) {
            logger.warn("Service has expired", {
                service: service.ServiceCode,
                operator: service.RegisteredOperatorRef,
            });

            return null;
        }

        if (isTnds && !isRequiredTndsDataset(filePath) && !isRequiredTndsServiceMode(service.Mode)) {
            logger.warn("Ignoring TNDS service with mode", {
                service: service.ServiceCode,
                mode: service.Mode,
            });

            return null;
        }

        const operator = operators.find((operator) => operator["@_id"] === service.RegisteredOperatorRef);

        if (!operator) {
            logger.warn(`Unable to find operator with registered operator ref: ${service.RegisteredOperatorRef}`, {
                filePath,
            });

            return null;
        }

        const noc = getNationalOperatorCode(operator);
        const agency = agencyData.find((agency) => agency.noc === noc);

        if (!agency) {
            logger.warn(`Unable to find agency with national operator code: ${noc}`, {
                filePath,
            });

            return null;
        }

        const vehicleJourneysForLines = service.Lines.Line.flatMap((line) =>
            vehicleJourneys.filter((journey) => journey.LineRef === line["@_id"]),
        );

        if (!vehicleJourneysForLines.length) {
            logger.warn("No vehicle journeys found for lines", {
                service: service.ServiceCode,
                operator: service.RegisteredOperatorRef,
            });

            return null;
        }

        const { routes, isDuplicateRoute } = await processRoutes(dbClient, service, agency, isTnds);

        if (isDuplicateRoute) {
            logger.warn("Duplicate TNDS route found for service", {
                service: service.ServiceCode,
                operator: service.RegisteredOperatorRef,
            });

            return null;
        }

        if (!routes) {
            logger.warn("No routes found for service", {
                service: service.ServiceCode,
                operator: service.RegisteredOperatorRef,
            });

            return null;
        }

        let vehicleJourneyMappings = vehicleJourneysForLines.map((vehicleJourney) => {
            const vehicleJourneyMapping: VehicleJourneyMapping = {
                vehicleJourney,
                routeId: 0,
                serviceId: 0,
                shapeId: "",
                tripId: "",
                serviceCode: service.ServiceCode,
                journeyPattern: getJourneyPatternForVehicleJourney(vehicleJourney, vehicleJourneys, services),
            };

            const route = routes.find((r) => {
                if (isTnds) {
                    return r.line_id === `${service.ServiceCode}_${vehicleJourney.LineRef}`;
                }

                return r.line_id === vehicleJourney.LineRef;
            });

            if (route) {
                vehicleJourneyMapping.routeId = route.id;
            } else {
                logger.warn(`Unable to find route with line ref: ${vehicleJourney.LineRef}`);
            }

            return vehicleJourneyMapping;
        });

        vehicleJourneyMappings = await processCalendars(
            dbClient,
            service,
            vehicleJourneyMappings,
            bankHolidaysJson,
            servicedOrganisations,
        );
        vehicleJourneyMappings = await processShapes(dbClient, txcRoutes, txcRouteSections, vehicleJourneyMappings);
        vehicleJourneyMappings = await processTrips(dbClient, vehicleJourneyMappings, filePath, service.Mode);
        await processFrequencies(dbClient, vehicleJourneyMappings);
        await processStopTimes(dbClient, txcJourneyPatternSections, vehicleJourneyMappings);
    });

    return Promise.all(promises);
};

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

    const txcJson = txcSchema.safeParse(parsedTxc);

    if (!txcJson.success) {
        const validationError = fromZodError(txcJson.error);
        logger.error(validationError.toString());

        throw validationError;
    }

    return txcJson.data;
};

const processRecord = async (record: S3EventRecord, bankHolidaysJson: BankHolidaysJson, dbClient: KyselyDb) => {
    logger.info(`Starting txc processor for file: ${record.s3.object.key}`);

    const isTnds = record.s3.bucket.name.includes("-tnds-");
    const txcData = await getAndParseTxcData(record.s3.bucket.name, record.s3.object.key);

    const { TransXChange } = txcData;
    const operators = TransXChange.Operators?.Operator || [];
    const journeyPatternSections = TransXChange.JourneyPatternSections?.JourneyPatternSection || [];
    const routes = TransXChange.Routes?.Route || [];
    const routeSections = TransXChange.RouteSections?.RouteSection || [];
    const services = TransXChange.Services?.Service || [];
    const stopPoints = TransXChange.StopPoints?.StopPoint || [];
    const annotatedStopPointRefs = TransXChange.StopPoints?.AnnotatedStopPointRef || [];
    const vehicleJourneys = TransXChange.VehicleJourneys?.VehicleJourney || [];

    const agencyData = await processAgencies(dbClient, operators);

    const useStopLocality = services.some((service) => service.Mode && service.Mode !== "bus");

    if (stopPoints.length > 0) {
        await processStopPoints(dbClient, stopPoints, useStopLocality);
    }

    if (annotatedStopPointRefs.length > 0) {
        await processAnnotatedStopPointRefs(dbClient, annotatedStopPointRefs, useStopLocality);
    }

    await processServices(
        dbClient,
        bankHolidaysJson,
        operators,
        services,
        vehicleJourneys,
        routeSections,
        routes,
        journeyPatternSections,
        agencyData,
        record.s3.object.key,
        isTnds,
        TransXChange.ServicedOrganisations?.ServicedOrganisation,
    );
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { BANK_HOLIDAYS_BUCKET_NAME: bankHolidaysBucketName, STAGE: stage } = process.env;

    if (!bankHolidaysBucketName) {
        throw new Error("Missing env vars - BANK_HOLIDAYS_BUCKET_NAME must be set");
    }

    dbClient = dbClient || (await getDatabaseClient(stage === "local"));
    const record = event.Records[0];

    if (!record.s3.object.key.endsWith(".xml")) {
        logger.info("Ignoring non-xml file");
        return;
    }

    try {
        logger.info("Retrieving bank holidays JSON");
        const bankHolidaysJson = await getBankHolidaysJson(bankHolidaysBucketName);
        logger.info("Starting processing of TXC");

        await processRecord(record, bankHolidaysJson, dbClient);

        logger.info("TXC processor successful");
    } catch (e) {
        if (e instanceof InvalidOperatorError) {
            logger.warn(e, `Invalid operator for TXC: ${record.s3.object.key}`);
        } else if (e instanceof Error) {
            logger.error(e, "There was a problem with the bods txc processor");
            throw e;
        } else {
            throw e;
        }
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
