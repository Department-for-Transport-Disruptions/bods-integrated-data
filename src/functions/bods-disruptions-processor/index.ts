import { randomUUID } from "node:crypto";
import { siriSxArrayProperties } from "@bods-integrated-data/shared/constants";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { generateGtfsRtFeed } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object, putS3Object } from "@bods-integrated-data/shared/s3";
import { PtSituationElement, siriSxSchema } from "@bods-integrated-data/shared/schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { transit_realtime } from "gtfs-realtime-bindings";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
    getGtfsActivePeriods,
    getGtfsCause,
    getGtfsEffect,
    getGtfsInformedIdentities,
    getGtfsSeverityLevel,
} from "./utils";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const getAndParseData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => siriSxArrayProperties.includes(tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new InvalidXmlError("No xml");
    }

    const parsedXml = parser.parse(xml);
    const parseResult = siriSxSchema.safeParse(parsedXml);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);
        logger.error(validationError.toString());

        throw new InvalidXmlError();
    }

    return parseResult.data;
};

const mapPtSituationsToGtfsAlertEntities = async (
    dbClient: KyselyDb,
    ptSituations: PtSituationElement[],
): Promise<transit_realtime.IFeedEntity[]> => {
    const promises = ptSituations.flatMap((ptSituation) => {
        if (!ptSituation.Consequences) {
            return [];
        }

        return ptSituation.Consequences.Consequence.map(async (consequence) => {
            const entity: transit_realtime.IFeedEntity = {
                id: randomUUID(),
                alert: {
                    activePeriod: getGtfsActivePeriods(ptSituation),
                    informedEntity: await getGtfsInformedIdentities(dbClient, consequence),
                    cause: getGtfsCause(ptSituation),
                    // @ts-ignore allow experimental property (not available in the gtfs-realtime-bindings library yet)
                    cause_detail: {
                        translation: [
                            {
                                text: ptSituation.Description || "",
                            },
                        ],
                    },
                    effect: getGtfsEffect(consequence),
                    // @ts-ignore allow experimental property (not available in the gtfs-realtime-bindings library yet)
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
                    headerText: {
                        translation: [
                            {
                                text: ptSituation.Summary || "",
                            },
                        ],
                    },
                    severityLevel: getGtfsSeverityLevel(consequence.Severity),
                },
            };

            return entity;
        });
    });

    return Promise.all(promises);
};

const uploadGtfsRtToS3 = async (bucketName: string, data: Uint8Array, saveJson: boolean) => {
    try {
        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt-service-alerts.bin",
            ContentType: "application/octet-stream",
            Body: data,
        });

        if (saveJson) {
            const decodedJson = transit_realtime.FeedMessage.decode(data);

            await putS3Object({
                Bucket: bucketName,
                Key: "gtfs-rt-service-alerts.json",
                ContentType: "application/json",
                Body: JSON.stringify(decodedJson),
            });
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem uploading GTFS-RT service alerts data to S3");
        }

        throw e;
    }
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

        await uploadGtfsRtToS3(bucketName, gtfsRtFeed, saveJson === "true");
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
