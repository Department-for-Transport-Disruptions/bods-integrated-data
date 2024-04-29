import { logger } from "@baselime/lambda-logger";
import { Agency, Database, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { BankHolidaysJson } from "@bods-integrated-data/shared/dates";
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
import { processAgencies } from "./data/agencies";
import { processCalendars } from "./data/calendar";
import { insertShapes, insertStopTimes, insertTrips } from "./data/database";
import { processFrequencies } from "./data/frequencies";
import { processRoutes } from "./data/routes";
import { processAnnotatedStopPointRefs, processStopPoints } from "./data/stops";
import { VehicleJourneyMapping } from "./types";
import { hasServiceExpired, isRequiredTndsDataset, isRequiredTndsServiceMode } from "./utils";

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
    dbClient: Kysely<Database>,
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
            bankHolidaysJson,
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
        await processFrequencies(dbClient, vehicleJourneyMappings);
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

const processRecord = async (record: S3EventRecord, bankHolidaysJson: BankHolidaysJson, dbClient: Kysely<Database>) => {
    logger.info(`Starting txc processor for file: ${record.s3.object.key}`);

    const isTnds = record.s3.bucket.name.includes("-tnds-");
    const txcData = await getAndParseTxcData(record.s3.bucket.name, record.s3.object.key);

    const { TransXChange } = txcData;

    if (!TransXChange.VehicleJourneys || TransXChange.VehicleJourneys.VehicleJourney.length === 0) {
        logger.warn(`No vehicle journeys found in file: ${record.s3.object.key}`);
        return;
    }

    const agencyData = await processAgencies(dbClient, TransXChange.Operators.Operator);

    if (TransXChange.StopPoints.StopPoint) {
        await processStopPoints(dbClient, TransXChange.StopPoints.StopPoint);
    } else if (TransXChange.StopPoints.AnnotatedStopPointRef) {
        await processAnnotatedStopPointRefs(dbClient, TransXChange.StopPoints.AnnotatedStopPointRef);
    }

    await processServices(
        dbClient,
        bankHolidaysJson,
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
    const { BANK_HOLIDAYS_BUCKET_NAME: bankHolidaysBucketName, STAGE: stage } = process.env;
    const dbClient = await getDatabaseClient(stage === "local");

    if (!bankHolidaysBucketName) {
        throw new Error("Missing env vars - BANK_HOLIDAYS_BUCKET_NAME must be set");
    }

    try {
        logger.info("Retrieving bank holidays JSON");
        const bankHolidaysJson = await getBankHolidaysJson(bankHolidaysBucketName);
        logger.info("Starting processing of TXC");

        await processRecord(event.Records[0], bankHolidaysJson, dbClient);

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
