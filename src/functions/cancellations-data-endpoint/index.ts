import {
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpSuccessResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { getCancellationsSubscription } from "@bods-integrated-data/shared/cancellations/utils";
import { siriSxArrayProperties } from "@bods-integrated-data/shared/constants";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import {
    AvlSubscription,
    HeartbeatNotification,
    heartbeatNotificationSchema,
} from "@bods-integrated-data/shared/schema";
import { CancellationsSubscription } from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import { SubscriptionIdNotFoundError, isApiGatewayEvent } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { ALBEvent, ALBHandler, APIGatewayProxyEvent, APIGatewayProxyHandler, Context } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

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

const processHeartbeatNotification = async (
    data: HeartbeatNotification,
    subscription: CancellationsSubscription,
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
        heartbeatLastReceivedDateTime: getDate().toISOString(),
    });
};

const uploadSiriSxToS3 = async (xml: string, bucketName: string, subscription: AvlSubscription, tableName: string) => {
    logger.info("SIRI-SX Vehicle Cancellation data received - uploading data to S3");

    const currentTime = getDate().toISOString();

    await putS3Object({
        Bucket: bucketName,
        Key: `${subscription.PK}/${currentTime}.xml`,
        ContentType: "application/xml",
        Body: xml,
    });

    await putDynamoItem(tableName, subscription.PK, "SUBSCRIPTION", {
        ...subscription,
        lastCancellationsDataReceivedDateTime: currentTime,
    });

    logger.info("Successfully uploaded SIRI-SX to S3");
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => siriSxArrayProperties.includes(tagName),
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

        let pathParams = null;

        if (stage !== "local") {
            pathParams = isApiGatewayEvent(event)
                ? event.pathParameters
                : {
                      subscriptionId: event.path.split("/cancellations/")[1],
                  };
        }

        const parameters = stage === "local" ? event.queryStringParameters : pathParams;

        const { subscriptionId } = requestParamsSchema.parse(parameters);

        logger.subscriptionId = subscriptionId;
        const body = requestBodySchema.parse(event.body);

        const subscription = await getCancellationsSubscription(subscriptionId, tableName);

        const requestApiKey = event.queryStringParameters?.apiKey;

        if (isApiGatewayEvent(event) && requestApiKey !== subscription.apiKey) {
            throw new InvalidApiKeyError(`Invalid API key '${requestApiKey}' for subscription ID: ${subscriptionId}`);
        }

        const xml = parseXml(body);

        if (xml?.Siri?.HeartbeatNotification) {
            await processHeartbeatNotification(heartbeatNotificationSchema.parse(xml), subscription, tableName);
            return createHttpSuccessResponse();
        }

        if (subscription.status === "inactive") {
            logger.error("Subscription is inactive, data will not be processed...", { subscriptionId });
            return createHttpNotFoundErrorResponse("Subscription is inactive");
        }

        if (
            xml?.Siri?.ServiceDelivery?.SituationExchangeDelivery &&
            (!xml?.Siri?.ServiceDelivery?.SituationExchangeDelivery?.Situations.PtSituationElement ||
                xml?.Siri?.ServiceDelivery?.SituationExchangeDelivery?.Situations.PtSituationElement[0] === "")
        ) {
            logger.warn(
                "Received cancellations data with no PtSituationElement from data producer, data will be ignored...",
            );
            return createHttpSuccessResponse();
        }

        await uploadSiriSxToS3(body, bucketName, subscription, tableName);
        return createHttpSuccessResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            logger.warn(e, "Unauthorized request");
            return createHttpUnauthorizedErrorResponse();
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createHttpNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the cancellations data endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
