import { logger } from "@baselime/lambda-logger";
import { Agency, Database, getDatabaseClient, getS3Object } from "@bods-integrated-data/shared";
import { TxcRouteSection, Service, VehicleJourney, txcSchema, TxcRoute } from "@bods-integrated-data/shared/schema";
import { S3Event } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { Kysely } from "kysely";
import { fromZodError } from "zod-validation-error";
import { insertAgencies, insertCalendars, insertRoutes, insertShapes, insertStops, insertTrips } from "./data/database";
import { VehicleJourneyMapping } from "./types";

const txcArrayProperties = [
    "ServicedOrganisation",
    "AnnotatedStopPointRef",
    "RouteSection",
    "Route",
    "JourneyPatternSection",
    "Operator",
    "Garage",
    "Service",
    "Line",
    "JourneyPattern",
    "VehicleJourney",
    "VehicleJourneyTimingLink",
];

const processServices = (
    dbClient: Kysely<Database>,
    services: Service[],
    vehicleJourneys: VehicleJourney[],
    txcRouteSections: TxcRouteSection[],
    txcRoutes: TxcRoute[],
    agencyData: Agency[],
) => {
    const promises = services.flatMap(async (service) => {
        const routeData = await insertRoutes(dbClient, service, agencyData);

        if (!routeData) {
            logger.warn("No route data found for service", {
                service: service.ServiceCode,
                operator: service.RegisteredOperatorRef,
            });

            return null;
        }

        const vehicleJourneysForLine = routeData.flatMap((route) => {
            return vehicleJourneys.filter((journey) => journey.LineRef === route.line_id);
        });

        let vehicleJourneyMappings = vehicleJourneysForLine.map((vehicleJourney) => {
            const vehicleJourneyMapping: VehicleJourneyMapping = {
                vehicleJourney,
                routeId: 0,
                serviceId: 0,
                shapeId: "",
            };

            const route = routeData.find((r) => r.line_id === vehicleJourney.LineRef);

            if (route) {
                vehicleJourneyMapping.routeId = route.id;
            } else {
                logger.warn(`Unable to find route with line ref: ${vehicleJourney.LineRef}`);
            }

            return vehicleJourneyMapping;
        });

        await insertCalendars(dbClient, service, vehicleJourneyMappings);
        vehicleJourneyMappings = await insertCalendars(dbClient, service, vehicleJourneyMappings);
        vehicleJourneyMappings = await insertShapes(
            dbClient,
            services,
            txcRoutes,
            txcRouteSections,
            vehicleJourneyMappings,
        );
        await insertTrips(dbClient, services, vehicleJourneyMappings, routeData);
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

export const handler = async (event: S3Event) => {
    const { bucket, object } = event.Records[0].s3;
    const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

    try {
        logger.info(`Starting txc processor for file: ${object.key}`);

        const txcData = await getAndParseTxcData(bucket.name, object.key);

        const { TransXChange } = txcData;

        const agencyData = await insertAgencies(dbClient, TransXChange.Operators.Operator);

        await insertStops(dbClient, TransXChange.StopPoints.AnnotatedStopPointRef);

        await processServices(
            dbClient,
            TransXChange.Services.Service,
            TransXChange.VehicleJourneys.VehicleJourney,
            TransXChange.RouteSections.RouteSection,
            TransXChange.Routes.Route,
            agencyData,
        );

        logger.info("TXC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(`There was a problem with the bods txc processor for file: ${object.key}`, e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
