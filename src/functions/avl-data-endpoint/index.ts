import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createSuccessResponse,
    createUnauthorizedErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import {
    AvlSubscription,
    HeartbeatNotification,
    heartbeatNotificationSchema,
} from "@bods-integrated-data/shared/schema";
import { isApiGatewayEvent } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { ALBEvent, ALBHandler, APIGatewayProxyEvent, APIGatewayProxyHandler, Context } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

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

const arrayProperties = ["VehicleActivity", "OnwardCall", "VehicleActivityCancellation"];

const processHeartbeatNotification = async (
    data: HeartbeatNotification,
    subscription: AvlSubscription,
    tableName: string,
) => {
    logger.info("Heartbeat notification received: processing notification");

    if (data.Siri.HeartbeatNotification.Status !== "true") {
        logger.warn(`Heartbeat notification for subscription: ${subscription.PK} did not include a status of true`);
        return;
    }

    logger.info("Updating DynamoDB with heartbeat notification information");

    await putDynamoItem(tableName, subscription.PK, "SUBSCRIPTION", {
        ...subscription,
        heartbeatLastReceivedDateTime: getDate(data.Siri.HeartbeatNotification.RequestTimestamp).toISOString(),
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

    return parser.parse(xml);
};

export const handler: APIGatewayProxyHandler & ALBHandler = async (
    event: APIGatewayProxyEvent | ALBEvent,
    context: Context,
) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

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
            return createSuccessResponse();
        }

        logger.subscriptionId = subscriptionId;
        const body = requestBodySchema.parse(event.body);

        const subscription = await getAvlSubscription(subscriptionId, tableName);
        const requestApiKey = event.queryStringParameters?.apiKey;

        if (isApiGatewayEvent(event) && requestApiKey !== subscription.apiKey) {
            throw new InvalidApiKeyError(`Invalid API key '${requestApiKey}' for subscription ID: ${subscriptionId}`);
        }

        const xml = parseXml(body);

        if (xml?.Siri?.HeartbeatNotification) {
            await processHeartbeatNotification(heartbeatNotificationSchema.parse(xml.Siri), subscription, tableName);
            return createSuccessResponse();
        }

        if (subscription.status !== "live") {
            logger.error("Subscription is not live, data will not be processed...");
            return createNotFoundErrorResponse("Subscription is not live");
        }

        if (xml?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.VehicleActivityCancellation) {
            logger.warn("Received cancellation data from data producer, data will be ignored...");
            return createSuccessResponse();
        }

        if (
            xml?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery &&
            (!xml?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.VehicleActivity ||
                xml?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.VehicleActivity[0] === "")
        ) {
            logger.warn("Received location data with no Vehicle Activity from data producer, data will be ignored...");
            return createSuccessResponse();
        }

        await uploadSiriVmToS3(body, bucketName, subscription, tableName);
        return createSuccessResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            logger.warn(`Unauthorized request: ${e.message}`);
            return createUnauthorizedErrorResponse();
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
