import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createUnauthorizedErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { isApiGatewayEvent } from "@bods-integrated-data/shared/utils";
import {
    InvalidApiKeyError,
    InvalidXmlError,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { ALBEvent, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";
import { HeartbeatNotification, dataEndpointInputSchema, heartbeatNotificationSchema } from "./heartbeat.schema";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createStringLengthValidation("subscriptionId"),
    }),
);

const requestBodySchema = z.string({
    required_error: "Body is required",
    invalid_type_error: "Body must be a string",
});

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

        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const handler = async (event: APIGatewayProxyEvent | ALBEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { STAGE: stage, BUCKET_NAME: bucketName, TABLE_NAME: tableName } = process.env;

        if (!bucketName || !tableName) {
            throw new Error("Missing env vars - BUCKET_NAME and TABLE_NAME must be set");
        }

        const pathParams = isApiGatewayEvent(event)
            ? event.pathParameters
            : {
                  subscriptionId: event.path.split("/")[1],
              };

        const parameters = stage === "local" ? event.queryStringParameters : pathParams;

        const { subscriptionId } = requestParamsSchema.parse(parameters);

        if (subscriptionId === "health") {
            return {
                statusCode: 200,
                body: "",
            };
        }

        const body = requestBodySchema.parse(event.body);

        logger.info(`Starting data endpoint for subscription ID: ${subscriptionId}`);

        const subscription = await getAvlSubscription(subscriptionId, tableName);
        const requestApiKey = event.queryStringParameters?.apiKey;

        if (isApiGatewayEvent(event) && requestApiKey !== subscription.apiKey) {
            throw new InvalidApiKeyError(`Invalid API key '${requestApiKey}' for subscription ID '${subscriptionId}'`);
        }

        const xml = parseXml(body);

        if (Object.hasOwn(xml, "HeartbeatNotification")) {
            await processHeartbeatNotification(heartbeatNotificationSchema.parse(xml), subscription, tableName);
        } else {
            if (subscription.status !== "LIVE") {
                logger.error(`Subscription: ${subscriptionId} is not LIVE, data will not be processed...`);
                return createNotFoundErrorResponse("Subscription is not live");
            }
            await uploadSiriVmToS3(body, bucketName, subscription, tableName);
        }

        return {
            statusCode: 200,
            body: "",
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            logger.warn(`Unauthorized request: ${e.message}`);
            return createUnauthorizedErrorResponse();
        }

        if (e instanceof InvalidXmlError) {
            logger.warn("Invalid SIRI-VM XML provided", e);
            return createValidationErrorResponse(["Body must be valid SIRI-VM XML"]);
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error("Subscription not found", e);
            return createNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the Data endpoint", e);
        }

        return createServerErrorResponse();
    }
};
