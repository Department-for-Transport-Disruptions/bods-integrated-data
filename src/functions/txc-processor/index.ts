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
} from "@bods-integrated-data/shared/schema";
import { S3Event, S3EventRecord, SQSEvent } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { Kysely } from "kysely";
import { fromZodError } from "zod-validation-error";
import { processCalendars } from "./data/calendar";
import {
    insertAgencies,
    insertFrequencies,
    insertRoutes,
    insertShapes,
    insertStopTimes,
    insertStops,
    insertTrips,
} from "./data/database";
import { VehicleJourneyMapping } from "./types";
import { hasServiceExpired } from "./utils";

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
];

const processServices = (
    dbClient: Kysely<Database>,
    services: Service[],
    vehicleJourneys: VehicleJourney[],
    txcRouteSections: TxcRouteSection[],
    txcRoutes: TxcRoute[],
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    agencyData: Agency[],
    filePath: string,
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

        const routeData = await insertRoutes(dbClient, service, agencyData);

        if (!routeData) {
            logger.warn("No route data found for service", {
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

            const route = routeData.find((r) => r.line_id === vehicleJourney.LineRef);

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
        vehicleJourneyMappings = await insertTrips(dbClient, services, vehicleJourneyMappings, routeData, filePath);
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

const processSqsRecord = async (record: S3EventRecord, dbClient: Kysely<Database>) => {
    logger.info(`Starting txc processor for file: ${record.s3.object.key}`);

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
        TransXChange.Services.Service,
        TransXChange.VehicleJourneys.VehicleJourney,
        TransXChange.RouteSections.RouteSection,
        TransXChange.Routes.Route,
        TransXChange.JourneyPatternSections.JourneyPatternSection,
        agencyData,
        record.s3.object.key,
        TransXChange.ServicedOrganisations?.ServicedOrganisation,
    );
};

export const handler = async (event: SQSEvent) => {
    const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

    try {
        logger.info(`Starting processing of TXC. Number of records to process: ${event.Records.length}`);

        await Promise.all(
            event.Records.map((record) => processSqsRecord((JSON.parse(record.body) as S3Event).Records[0], dbClient)),
        );

        logger.info("TXC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(`There was a problem with the bods txc processor, rolling back transaction`, e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
