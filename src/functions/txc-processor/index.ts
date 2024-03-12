import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient, getS3Object } from "@bods-integrated-data/shared";
import { txcSchema } from "@bods-integrated-data/shared/schema";
import { S3Event } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { fromZodError } from "zod-validation-error";
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

const getAndParseTxcData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        numberParseOptions: {
            hex: false,
            leadingZeros: false,
        },
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

    try {
        const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

        logger.info(`Starting txc processor for file: ${object.key}`);

        const txcData = await getAndParseTxcData(bucket.name, object.key);

        const agencyData = await insertAgencies(dbClient, txcData.TransXChange.Operators.Operator);

        logger.info("data", agencyData);

        logger.info("TXC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(`There was a problem with the bods txc processor for file: ${object.key}`, e);
        }

        throw e;
    }
};
