import { randomUUID } from "node:crypto";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { generateGtfsRtFeed } from "@bods-integrated-data/shared/gtfs-rt/utils";
import {} from "@bods-integrated-data/shared/logger";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object, putS3Object } from "@bods-integrated-data/shared/s3";
import { PtSituation, situationSchema } from "@bods-integrated-data/shared/schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { transit_realtime } from "gtfs-realtime-bindings";
import { fromZodError } from "zod-validation-error";
import { getAgency, getGtfsActivePeriods, getGtfsCause, getGtfsEffect, getGtfsSeverityLevel, getRoute } from "./utils";

const arrayProperties = [
    "PtSituationElement",
    "ValidityPeriod",
    "AffectedNetwork",
    "AffectedVehicleJourney",
    "AffectedLine",
    "AffectedStopPoint",
    "Call",
    "Consequence",
];

const getAndParseData = async (bucketName: string, objectKey: string) => {
    const file = await getS3Object({
        Bucket: bucketName,
        Key: objectKey,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new InvalidXmlError("No xml");
    }

    const parsedXml = parser.parse(xml);
    const parseResult = situationSchema.safeParse(parsedXml);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);
        logger.error(validationError.toString());

        throw new InvalidXmlError();
    }

    return parseResult.data;
};

const mapPtSituationsToGtfsAlertEntities = async (
    dbClient: KyselyDb,
    ptSituations: PtSituation[],
): Promise<transit_realtime.IFeedEntity[]> => {
    const promises = ptSituations.flatMap((ptSituation) => {
        return ptSituation.Consequences.Consequence.map(async (consequence) => {
            let operatorRef = undefined;
            let lineRef = undefined;
            let agencyId = undefined;
            let routeId = undefined;
            let routeType = undefined;
            let stopId = undefined;

            if (consequence.Affects?.Networks?.AffectedNetwork) {
                for (const affectedNetwork of consequence.Affects.Networks.AffectedNetwork) {
                    if (affectedNetwork.AffectedLine) {
                        for (const affectedLine of affectedNetwork.AffectedLine) {
                            if (!operatorRef && affectedLine.AffectedOperator?.OperatorRef) {
                                operatorRef = affectedLine.AffectedOperator.OperatorRef;
                            }

                            if (!lineRef) {
                                lineRef = affectedLine.LineRef;
                            }
                        }
                    }
                }
            }

            if (consequence.Affects?.StopPoints?.AffectedStopPoint) {
                for (const affectedStopPoint of consequence.Affects.StopPoints.AffectedStopPoint) {
                    if (affectedStopPoint.StopPointRef) {
                        stopId = affectedStopPoint.StopPointRef;
                        break;
                    }
                }
            }

            if (operatorRef) {
                const agency = await getAgency(dbClient, operatorRef);
                agencyId = agency?.id;
            }

            if (lineRef) {
                const route = await getRoute(dbClient, lineRef);
                routeId = route?.id;
                routeType = route?.route_type;
            }

            const entity: transit_realtime.IFeedEntity = {
                id: randomUUID(),
                alert: {
                    activePeriod: getGtfsActivePeriods(ptSituation),
                    informedEntity: [
                        {
                            agencyId: agencyId?.toString(),
                            routeId: routeId?.toString(),
                            routeType,
                            stopId,
                        },
                    ],
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
                        translation: [
                            {
                                text: ptSituation.InfoLinks?.InfoLink.Uri || "",
                            },
                        ],
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
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem uploading GTFS-RT service alerts data to S3", error);
        }

        throw error;
    }
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { bucket, object } = event.Records[0].s3;
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

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
            logger.error("There was a problem with the disruptions processor", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
