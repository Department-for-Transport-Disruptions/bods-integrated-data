import { randomUUID } from "node:crypto";
import {
    createConflictErrorResponse,
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createSuccessResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    SubscriptionTriggerMessage,
    getAvlConsumerSubscription,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { getDuration } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { createSchedule } from "@bods-integrated-data/shared/eventBridge";
import { createEventSourceMapping } from "@bods-integrated-data/shared/lambda";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription, avlSubscriptionRequestSchema } from "@bods-integrated-data/shared/schema";
import { createQueue } from "@bods-integrated-data/shared/sqs";
import {
    InvalidXmlError,
    createStringLengthValidation,
    createSubscriptionIdArrayValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";

const requestHeadersSchema = z.object({
    userId: createStringLengthValidation("userId header"),
});

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createSubscriptionIdArrayValidation("subscriptionId"),
    }),
);

const requestBodySchema = z.string({
    required_error: "Body is required",
    invalid_type_error: "Body must be a string",
});

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
    });

    const parsedXml = parser.parse(xml);
    const parsedJson = avlSubscriptionRequestSchema.safeParse(parsedXml);

    if (!parsedJson.success) {
        const validationError = fromZodError(parsedJson.error);
        throw new InvalidXmlError(validationError.toString());
    }

    return parsedJson.data;
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const {
            AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
            AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME,
            AVL_CONSUMER_SUBSCRIPTION_SEND_DATA_FUNCTION_NAME,
            AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN,
            AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN,
        } = process.env;

        if (
            !AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME ||
            !AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME ||
            !AVL_CONSUMER_SUBSCRIPTION_SEND_DATA_FUNCTION_NAME ||
            !AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN ||
            !AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN
        ) {
            throw new Error(
                "Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME, AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME, AVL_CONSUMER_SUBSCRIPTION_SEND_DATA_FUNCTION_NAME, AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN and AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN must be set",
            );
        }

        const { userId } = requestHeadersSchema.parse(event.headers);
        const requestParams = requestParamsSchema.parse(event.queryStringParameters);
        const producerSubscriptionIds = requestParams.subscriptionId;

        const body = requestBodySchema.parse(event.body);
        const xml = parseXml(body);
        const subscriptionRequest = xml.Siri.SubscriptionRequest;
        const subscriptionId = subscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier;
        const updateInterval = subscriptionRequest.VehicleMonitoringSubscriptionRequest.UpdateInterval;
        let PK = undefined;

        try {
            const subscription = await getAvlConsumerSubscription(
                AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
                subscriptionId,
                userId,
            );

            if (subscription.status === "live") {
                return createConflictErrorResponse("Consumer subscription ID is already live");
            }

            PK = subscription.PK;
        } catch (_error) {
            // ignore caught error when no existing subscription is found
        }

        const producerSubscriptions = await getAvlSubscriptions(AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME);

        for (const producerSubscriptionId of producerSubscriptionIds.split(",")) {
            const subscription = producerSubscriptions.find(({ PK }) => PK === producerSubscriptionId);

            if (!subscription || subscription.status === "inactive") {
                return createNotFoundErrorResponse(`Producer subscription ID not found: ${producerSubscriptionId}`);
            }
        }

        const consumerSubscription: AvlConsumerSubscription = {
            PK: PK || randomUUID(),
            SK: userId,
            subscriptionId,
            status: "live",
            url: subscriptionRequest.ConsumerAddress,
            requestorRef: subscriptionRequest.RequestorRef,
            heartbeatInterval: subscriptionRequest.SubscriptionContext.HeartbeatInterval,
            initialTerminationTime: subscriptionRequest.VehicleMonitoringSubscriptionRequest.InitialTerminationTime,
            requestTimestamp: subscriptionRequest.RequestTimestamp,
            producerSubscriptionIds,
            heartbeatAttempts: 0,
        };

        await putDynamoItem(
            AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
            consumerSubscription.PK,
            consumerSubscription.SK,
            consumerSubscription,
        );

        const queueUrl = await createQueue({
            QueueName: `consumer-subscription-queue-${subscriptionId}`,
        });

        await createEventSourceMapping({
            EventSourceArn: queueUrl,
            FunctionName: AVL_CONSUMER_SUBSCRIPTION_SEND_DATA_FUNCTION_NAME,
        });

        const queueMessage: SubscriptionTriggerMessage = {
            subscriptionId: consumerSubscription.PK,
            frequency: getDuration(updateInterval).asSeconds(),
            queueUrl,
        };

        await createSchedule({
            Name: `consumer-subscription-schedule-${subscriptionId}`,
            FlexibleTimeWindow: {
                Mode: "OFF",
            },
            ScheduleExpression: "rate(1 minute)",
            Target: {
                Arn: AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN,
                RoleArn: AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN,
                Input: JSON.stringify(queueMessage),
            },
        });

        return createSuccessResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, `Invalid SIRI-VM XML provided: ${e.message}`);
            return createValidationErrorResponse([e.message]);
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-subscriber endpoint");
        }

        return createServerErrorResponse();
    }
};
