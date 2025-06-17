import { txcArrayProperties } from "@bods-integrated-data/shared/constants";
import { Agency, KyselyDb, NewStop, getDatabaseClient } from "@bods-integrated-data/shared/database";
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
import { getBankHolidaysJson, notEmpty } from "@bods-integrated-data/shared/utils";
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
    insertedStopPoints: NewStop[],
    filePath: string,
    isTnds: boolean,
    revisionNumber: string,
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
        const agency = noc ? agencyData.find((agency) => agency.noc === noc.toUpperCase()) : null;

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

        const vehicleJourneyMappings = vehicleJourneysForLines.map((vehicleJourney) => {
            const vehicleJourneyMapping: VehicleJourneyMapping = {
                vehicleJourney,
                routeId: 0,
                serviceId: 0,
                shapeId: "",
                tripId: "",
                blockId: "",
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

        let vehicleJourneyMappingsWithCalendars = await processCalendars(
            dbClient,
            service,
            vehicleJourneyMappings,
            bankHolidaysJson,
            servicedOrganisations,
        );
        vehicleJourneyMappingsWithCalendars = await processShapes(
            dbClient,
            txcRoutes,
            txcRouteSections,
            vehicleJourneyMappingsWithCalendars,
        );
        vehicleJourneyMappingsWithCalendars = await processTrips(
            dbClient,
            vehicleJourneyMappingsWithCalendars,
            filePath,
            revisionNumber,
            service,
        );
        await processFrequencies(dbClient, vehicleJourneyMappingsWithCalendars);
        await processStopTimes(
            dbClient,
            txcJourneyPatternSections,
            vehicleJourneyMappingsWithCalendars,
            insertedStopPoints,
        );
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
    const revisionNumber = TransXChange["@_RevisionNumber"];

    const agencyData = await processAgencies(dbClient, operators);

    const useStopLocality = services.some((service) => service.Mode && service.Mode !== "bus");

    const insertedStopPoints: NewStop[] = [];

    const stopsInJourneyPatternSections = journeyPatternSections
        .flatMap((journeyPatternSection) =>
            journeyPatternSection.JourneyPatternTimingLink.flatMap((timingLink) => {
                const fromStopPointRef = timingLink.From?.StopPointRef;
                const toStopPointRef = timingLink.From?.StopPointRef;

                return [fromStopPointRef, toStopPointRef];
            }),
        )
        .filter(notEmpty);

    if (stopPoints.length > 0) {
        logger.info("Processing stop points");
        const processedStopPoints = await processStopPoints(
            dbClient,
            stopPoints,
            useStopLocality,
            stopsInJourneyPatternSections,
        );

        if (!processedStopPoints) {
            logger.warn(`Invalid stop points found in file: ${record.s3.object.key}, skipping service processing`);
            return;
        }

        insertedStopPoints.push(...processedStopPoints);
    }

    if (annotatedStopPointRefs.length > 0) {
        logger.info("Processing annotated stop point refs");
        const processedStopPoints = await processAnnotatedStopPointRefs(
            dbClient,
            annotatedStopPointRefs,
            useStopLocality,
            stopsInJourneyPatternSections,
        );

        if (!processedStopPoints) {
            logger.warn(`Invalid stop points found in file: ${record.s3.object.key}, skipping service processing`);
            return;
        }

        insertedStopPoints.push(...processedStopPoints);
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
        insertedStopPoints,
        record.s3.object.key,
        isTnds,
        revisionNumber,
        TransXChange.ServicedOrganisations?.ServicedOrganisation,
    );
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const { STAGE: stage } = process.env;

    dbClient = dbClient || (await getDatabaseClient(stage === "local"));
    const record = event.Records[0];

    if (!record.s3.object.key.endsWith(".xml")) {
        logger.info("Ignoring non-xml file");
        return;
    }

    try {
        logger.info("Retrieving bank holidays JSON");
        const bankHolidaysJson = await getBankHolidaysJson();
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
