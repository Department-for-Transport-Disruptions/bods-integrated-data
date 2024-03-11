import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient, getS3Object } from "@bods-integrated-data/shared";
import { txcSchema } from "@bods-integrated-data/shared/schema";
import { S3Event } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { insertAgencies } from "./data/database";

const txcArrayProperties = [
    "ServicedOrganisation",
    "AnnotatedStopPointRef",
    "RouteSection",
    "Route",
    "Location",
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

const getAndParseTxcData = async (event: S3Event) => {
    const { object, bucket } = event.Records[0].s3;

    const file = await getS3Object({
        Bucket: bucket.name,
        Key: object.key,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        isArray: (tagName) => txcArrayProperties.some((element) => element === tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new Error("No xml data");
    }

    const parsedTxc = parser.parse(xml) as Record<string, unknown>;

    return txcSchema.parse(parsedTxc);
};

export const handler = async (event: S3Event) => {
    try {
        const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

        logger.info(`Starting txc processor`);

        const txcData = await getAndParseTxcData(event);

        const agencyData = await insertAgencies(dbClient, txcData.TransXChange.Operators.Operator);

        logger.info("data", agencyData);

        logger.info("TXC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the txc processor", e);
        }

        throw e;
    }
};
