import { logger } from "@baselime/lambda-logger";
import { getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ClientError } from "./errors";
import { HeartbeatNotification, dataEndpointInputSchema, heartbeatNotificationSchema } from "./heartbeat.schema";

const arrayProperties = ["VehicleActivity", "OnwardCall"];

const processHeartbeatNotification = async (
    data: HeartbeatNotification,
    subscription: AvlSubscription,
    tableName: string,
) => {
    logger.info("Heartbeat notification received: processing notification");

    if (data.HeartbeatNotification.Status !== "true") {
        logger.warn(`Heartbeat notification for subscription: ${subscription.PK} did not include a status of true`);
        return;
    }

    logger.info("Updating DynamoDB with heartbeat notification information");

    await putDynamoItem(tableName, subscription.PK, "SUBSCRIPTION", {
        ...subscription,
        heartbeatLastReceivedDateTime: data.HeartbeatNotification.RequestTimestamp,
    });
};

const uploadSiriVmToS3 = async (xml: string, bucketName: string, subscription: AvlSubscription, tableName: string) => {
    logger.info("SIRI-VM Vehicle Journey data received - uploading data to S3");

    const currentTime = getDate().toISOString();

    await putS3Object({
        Bucket: bucketName,
        Key: `${subscription.PK}/${currentTime}.xml`,
        ContentType: "application/xml",
        Body: xml,
    });

    await putDynamoItem(tableName, subscription.PK, "SUBSCRIPTION", {
        ...subscription,
        lastAvlDataReceivedDateTime: currentTime,
    });

    logger.info("Successfully uploaded SIRI-VM to S3");
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    // Check if Siri received is either SIRI-VM Vehicle Journey data or a Heartbeat Notification
    const parsedJson = dataEndpointInputSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the xml from the data producer.", parsedJson.error.format());

        throw new ClientError();
    }

    return parsedJson.data;
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const { STAGE: stage, BUCKET_NAME: bucketName, TABLE_NAME: tableName } = process.env;

        if (!bucketName || !tableName) {
            throw new Error("Missing env vars - BUCKET_NAME and TABLE_NAME must be set");
        }

        logger.info("Starting Data Endpoint");

        const subscriptionId =
            stage === "local" ? event?.queryStringParameters?.subscription_id : event?.pathParameters?.subscription_id;

        if (!subscriptionId) {
            throw new Error("Subscription ID missing from path parameters");
        }

        if (!event.body) {
            throw new Error("No body sent with event");
        }

        logger.info(`Starting data endpoint for subscription ID: ${subscriptionId}`);

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        const data = parseXml(event.body);

        if (Object.hasOwn(data, "HeartbeatNotification")) {
            await processHeartbeatNotification(heartbeatNotificationSchema.parse(data), subscription, tableName);
        } else {
            if (subscription.status !== "LIVE") {
                logger.warn(`Subscription: ${subscriptionId} is not ACTIVE, data will not be processed...`);
                return {
                    statusCode: 404,
                    body: `Subscription with Subscription ID: ${subscriptionId} is not ACTIVE in the service.`,
                };
            }
            await uploadSiriVmToS3(event.body, bucketName, subscription, tableName);
        }

        return {
            statusCode: 200,
        };
    } catch (e) {
        if (e instanceof ClientError) {
            logger.warn("Invalid XML provided.", e);
            return { statusCode: 400 };
        }
        if (e instanceof Error) {
            logger.error("There was a problem with the Data endpoint", e);
        }
        throw e;
    }
};
