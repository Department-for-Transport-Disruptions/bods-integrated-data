import { randomUUID } from "node:crypto";
import { RouteType } from "@bods-integrated-data/shared/database";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
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
import { getGtfsCause, getGtfsEffect, getGtfsSeverityLevel } from "./utils";

const arrayProperties = [
    "PtSituationElement",
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

const mapPtSituationsToGtfsAlertEntities = (ptSituations: PtSituation[]): transit_realtime.IFeedEntity[] => {
    return ptSituations.flatMap((ptSituation) => {
        return ptSituation.Consequences.Consequence.map<transit_realtime.IFeedEntity>((consequence) => ({
            id: randomUUID(),
            alert: {
                activePeriod: [
                    { start: getDate(ptSituation.ValidityPeriod.StartTime).unix() },
                    { end: getDate(ptSituation.ValidityPeriod.EndTime).unix() },
                ],
                informedEntity: [
                    {
                        agencyId: "",
                        routeId: "",
                        routeType: RouteType.Bus, // todo
                        stopId: "",
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
        }));
    });
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
        const entities = mapPtSituationsToGtfsAlertEntities(
            situationData.Siri.SituationExchangeDelivery.Situations.PtSituationElement,
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
