import { randomUUID } from "node:crypto";
import { siriSxArrayProperties } from "@bods-integrated-data/shared/constants";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { transit_realtime } from "@bods-integrated-data/shared/gtfs-realtime";
import { generateGtfsRtFeed, uploadGtfsRtToS3 } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { PtSituationElement, siriSxSchemaWrapper } from "@bods-integrated-data/shared/schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
    getAgencyMap,
    getGtfsActivePeriods,
    getGtfsCause,
    getGtfsEffect,
    getGtfsInformedIdentities,
    getGtfsSeverityLevel,
    getRouteMap,
} from "./utils";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const getAndParseData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new InvalidXmlError("No xml");
    }

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => siriSxArrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml);
    const { siriSxSchema } = siriSxSchemaWrapper();
    const parseResult = siriSxSchema.safeParse(parsedXml);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);
        logger.error(validationError.toString());

        throw new InvalidXmlError();
    }

    return parseResult.data;
};

const mapPtSituationsToGtfsAlertEntities = async (dbClient: KyselyDb, ptSituations: PtSituationElement[]) => {
    const agencyMap = await getAgencyMap(dbClient, ptSituations);
    const routeMap = await getRouteMap(dbClient, agencyMap, ptSituations);

    return ptSituations.flatMap((ptSituation) => {
        if (!ptSituation.Consequences) {
            return [];
        }

        return ptSituation.Consequences.Consequence.flatMap((consequence) => {
            const informedEntities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);

            // Omit entities that cannot be mapped to at least one agency/route/stop ID
            if (informedEntities.length === 0) {
                return [];
            }

            const entity: transit_realtime.IFeedEntity = {
                id: randomUUID(),
                alert: {
                    active_period: getGtfsActivePeriods(ptSituation),
                    informed_entity: informedEntities,
                    cause: getGtfsCause(ptSituation),
                    cause_detail: {
                        translation: [
                            {
                                text: ptSituation.Description || "",
                            },
                        ],
                    },
                    effect: getGtfsEffect(consequence),
                    effect_detail: {
                        translation: [
                            {
                                text: consequence.Advice?.Details || "",
                            },
                        ],
                    },
                    url: {
                        translation: ptSituation.InfoLinks?.InfoLink.map((link) => ({
                            text: link.Uri,
                        })),
                    },
                    header_text: {
                        translation: [
                            {
                                text: ptSituation.Summary || "",
                            },
                        ],
                    },
                    description_text: {
                        translation: [
                            {
                                text: ptSituation.Description || "",
                            },
                        ],
                    },
                    severity_level: getGtfsSeverityLevel(consequence.Severity),
                },
            };

            return entity;
        });
    });
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { bucket, object } = event.Records[0].s3;
    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        const { BUCKET_NAME: bucketName, SAVE_JSON: saveJson } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        logger.filepath = object.key;
        logger.info("Starting processing of disruptions data");

        const situationData = await getAndParseData(bucket.name, object.key);
        const entities = await mapPtSituationsToGtfsAlertEntities(
            dbClient,
            situationData.Siri.ServiceDelivery.SituationExchangeDelivery.Situations.PtSituationElement,
        );
        const gtfsRtFeed = generateGtfsRtFeed(entities);

        await uploadGtfsRtToS3(bucketName, "gtfs-rt-service-alerts", gtfsRtFeed, saveJson === "true");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the disruptions processor");
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
