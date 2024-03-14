import { logger } from "@baselime/lambda-logger";
import { Agency, Database, Route, getDatabaseClient, getS3Object } from "@bods-integrated-data/shared";
import { OperatingProfile, Service, VehicleJourney, txcSchema } from "@bods-integrated-data/shared/schema";
import { S3Event } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { Kysely } from "kysely";
import { fromZodError } from "zod-validation-error";
import { insertAgencies, insertCalendar, insertRoutes, insertShapes, insertStops } from "./data/database";
import { ServiceExpiredError } from "./errors";
import { formatCalendar } from "./utils";

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
    "StandardService",
    "VehicleJourney",
    "VehicleJourneyTimingLink",
];

const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
    RegularDayType: {
        DaysOfWeek: {
            MondayToSunday: "",
        },
    },
};

const getOperatingProfile = (service: Service, vehicleJourney: VehicleJourney) => {
    const operatingPeriod = service.OperatingPeriod;
    const vehicleJourneyOperatingProfile = vehicleJourney.OperatingProfile;
    const serviceOperatingProfile = service.OperatingProfile;

    const operatingProfileToUse =
        vehicleJourneyOperatingProfile || serviceOperatingProfile || DEFAULT_OPERATING_PROFILE;

    return formatCalendar(operatingProfileToUse, operatingPeriod);
};

const processVehicleJourneys = async (
    dbClient: Kysely<Database>,
    service: Service,
    routes: Route[],
    vehicleJourneys: VehicleJourney[],
) => {
    const promises = routes.flatMap((route) => {
        const vehicleJourneysForLine = vehicleJourneys.filter((journey) => journey.LineRef === route.line_id);

        return vehicleJourneysForLine.flatMap(async (journey) => {
            try {
                const calendar = getOperatingProfile(service, journey);

                const journeyCalendar = await insertCalendar(dbClient, calendar);

                if (!journeyCalendar) {
                    return null;
                }
            } catch (e) {
                if (e instanceof ServiceExpiredError) {
                    logger.warn(`Service expired: ${service.ServiceCode}`);
                }

                return null;
            }
        });
    });

    await Promise.all(promises);
};

const processServices = (
    dbClient: Kysely<Database>,
    services: Service[],
    vehicleJourneys: VehicleJourney[],
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

        await processVehicleJourneys(dbClient, service, routeData, vehicleJourneys);
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

        await insertShapes(dbClient, txcData.TransXChange.RouteSections.RouteSection);
        await insertStops(dbClient, txcData.TransXChange.StopPoints.AnnotatedStopPointRef);

        await processServices(
            dbClient,
            TransXChange.Services.Service,
            TransXChange.VehicleJourneys.VehicleJourney,
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
