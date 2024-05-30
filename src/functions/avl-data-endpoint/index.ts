import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getDynamoItem, putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ClientError } from "./errors";
import { HeartbeatNotification, dataEndpointInputSchema, heartbeatNotificationSchema } from "./heartbeat.schema";

const validateHeartbeatNotificationAndUploadToDynamo = async (
    data: HeartbeatNotification,
    subscriptionId: string,
    tableName: string,
) => {
    if (data.HeartbeatNotification.Status !== "true") {
        logger.warn(`Heartbeat notification for subscription: ${subscriptionId} did not include a status of true`);
        return;
    }

    const subscription = await getDynamoItem(tableName, { PK: subscriptionId, SK: "SUBSCRIPTION" });

    if (!subscription) {
        logger.error(`Subscription ID ${subscriptionId} not found in DynamoDB`);
        throw new Error("Subscription not found in DynamoDB");
    }

    logger.info("Updating DynamoDB with heartbeat notification information");

    await putDynamoItem(tableName, subscriptionId, "SUBSCRIPTION", {
        ...subscription,
        heartbeatLastReceivedDateTime: data.HeartbeatNotification.RequestTimestamp,
    });

    return;
};

const processNotification = async (xml: string, bucketName: string, subscriptionId: string, tableName: string) => {
    const data = parseXml(xml);

    if (data.hasOwnProperty("HeartbeatNotification")) {
        logger.info("Heartbeat notification received: processing notification");

        return validateHeartbeatNotificationAndUploadToDynamo(
            heartbeatNotificationSchema.parse(data),
            subscriptionId,
            tableName,
        );
    }

    logger.info("SIRI-VM Vehicle Journey data received - uploading data to S3");

    const currentTime = getDate();

    await putS3Object({
        Bucket: bucketName,
        Key: `${subscriptionId}/${currentTime.toISOString()}.xml`,
        ContentType: "application/xml",
        Body: xml,
    });

    logger.info("Successfully uploaded SIRI-VM to S3");
};

export const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => tagName === "VehicleActivity",
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

        const subscriptionId =
            stage === "local" ? event?.queryStringParameters?.subscription_id : event?.pathParameters?.subscription_id;

        if (!subscriptionId) {
            throw new Error("Subscription ID missing from path parameters");
        }

        logger.info("Starting Data Endpoint");

        if (!event.body) {
            throw new Error("No body sent with event");
        }
        await processNotification(event.body, bucketName, subscriptionId, tableName);

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
