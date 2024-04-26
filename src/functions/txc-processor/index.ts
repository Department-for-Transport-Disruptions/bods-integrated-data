import { logger } from "@baselime/lambda-logger";
import { Agency, Database, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import {
    TxcRouteSection,
    Service,
    VehicleJourney,
    txcSchema,
    TxcRoute,
    TxcJourneyPatternSection,
    ServicedOrganisation,
    Operator,
} from "@bods-integrated-data/shared/schema";
import { S3Event, S3EventRecord } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { Kysely } from "kysely";
import { fromZodError } from "zod-validation-error";
import { processCalendars } from "./data/calendar";
import {
    insertAgencies,
    insertFrequencies,
    insertShapes,
    insertStopTimes,
    insertStops,
    insertTrips,
} from "./data/database";
import { insertRoutes } from "./data/routes";
import { VehicleJourneyMapping } from "./types";
import { hasServiceExpired, isRequiredTndsDataset, isRequiredTndsServiceMode } from "./utils";

const txcArrayProperties = [
    "ServicedOrganisation",
    "AnnotatedStopPointRef",
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

const processServices = (
    dbClient: Kysely<Database>,
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
        const agency = agencyData.find((agency) => agency.noc === operator?.NationalOperatorCode);

        if (!agency) {
            logger.warn(`Unable to find agency with registered operator ref: ${service.RegisteredOperatorRef}`, {
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

        const { routes, isDuplicateRoute } = await insertRoutes(dbClient, service, agency, isTnds);

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
            };

            const route = routes.find((r) => r.line_id === vehicleJourney.LineRef);

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
            servicedOrganisations,
        );
        vehicleJourneyMappings = await insertShapes(
            dbClient,
            services,
            txcRoutes,
            txcRouteSections,
            vehicleJourneyMappings,
        );
        vehicleJourneyMappings = await insertTrips(dbClient, services, vehicleJourneyMappings, routes, filePath);
        await insertFrequencies(dbClient, vehicleJourneyMappings);
        await insertStopTimes(dbClient, services, txcJourneyPatternSections, vehicleJourneyMappings);
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
        isArray: (tagName) => txcArrayProperties.some((element) => element === tagName),
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

const processRecord = async (record: S3EventRecord, dbClient: Kysely<Database>) => {
    logger.info(`Starting txc processor for file: ${record.s3.object.key}`);

    const isTnds = record.s3.object.key.includes("/tnds/");
    const txcData = await getAndParseTxcData(record.s3.bucket.name, record.s3.object.key);

    const { TransXChange } = txcData;

    if (!TransXChange.VehicleJourneys || TransXChange.VehicleJourneys.VehicleJourney.length === 0) {
        logger.warn(`No vehicle journeys found in file: ${record.s3.object.key}`);
        return;
    }

    const agencyData = await insertAgencies(dbClient, TransXChange.Operators.Operator);

    await insertStops(dbClient, TransXChange.StopPoints.AnnotatedStopPointRef);

    await processServices(
        dbClient,
        TransXChange.Operators.Operator,
        TransXChange.Services.Service,
        TransXChange.VehicleJourneys.VehicleJourney,
        TransXChange.RouteSections.RouteSection,
        TransXChange.Routes.Route,
        TransXChange.JourneyPatternSections.JourneyPatternSection,
        agencyData,
        record.s3.object.key,
        isTnds,
        TransXChange.ServicedOrganisations?.ServicedOrganisation,
    );
};

export const handler = async (event: S3Event) => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting processing of TXC");

        await processRecord(event.Records[0], dbClient);

        logger.info("TXC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(`There was a problem with the bods txc processor`, e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
