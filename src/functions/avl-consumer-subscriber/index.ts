import { randomUUID } from "node:crypto";
import {
    createHttpConflictErrorResponse,
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpServiceUnavailableErrorResponse,
    createHttpSuccessResponse,
    createHttpTooManyRequestsErrorResponse,
    createHttpValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    AvlSubscriptionTriggerMessage,
    getAvlConsumerSubscription,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { getDuration } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { createSchedule } from "@bods-integrated-data/shared/eventBridge";
import { createEventSourceMapping } from "@bods-integrated-data/shared/lambda";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription, avlSubscriptionRequestSchema } from "@bods-integrated-data/shared/schema";
import { createQueue, getQueueAttributes } from "@bods-integrated-data/shared/sqs";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import {
    InvalidXmlError,
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createNmTokenValidation,
    createStringLengthValidation,
    createSubscriptionIdArrayValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import cleanDeep from "clean-deep";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";

z.setErrorMap(errorMapWithDataLogging);

const requestHeadersSchema = z.object({
    "x-user-id": createStringLengthValidation("x-user-id header"),
});

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        boundingBox: createBoundingBoxValidation("boundingBox").optional(),
        operatorRef: createNmTokenArrayValidation("operatorRef").optional(),
        vehicleRef: createNmTokenValidation("vehicleRef").optional(),
        lineRef: createNmTokenValidation("lineRef").optional(),
        producerRef: createNmTokenValidation("producerRef").optional(),
        originRef: createNmTokenValidation("originRef").optional(),
        destinationRef: createNmTokenValidation("destinationRef").optional(),
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
            AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN,
            AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN,
            AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN,
        } = process.env;

        if (
            !AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME ||
            !AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME ||
            !AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN ||
            !AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN ||
            !AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN
        ) {
            throw new Error(
                "Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME, AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME, AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN, AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN and AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN must be set",
            );
        }

        const headers = requestHeadersSchema.parse(event.headers);
        const userId = headers["x-user-id"];
        const {
            boundingBox,
            operatorRef,
            vehicleRef,
            lineRef,
            producerRef,
            originRef,
            destinationRef,
            subscriptionId,
        } = requestParamsSchema.parse(event.queryStringParameters);

        const body = requestBodySchema.parse(event.body);
        const xml = parseXml(body);
        const subscriptionRequest = xml.Siri.SubscriptionRequest;
        const consumerSubscriptionId = subscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier;
        const updateInterval = subscriptionRequest.VehicleMonitoringSubscriptionRequest.UpdateInterval || "PT10S";
        let PK = undefined;

        try {
            const subscription = await getAvlConsumerSubscription(
                AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
                userId,
                consumerSubscriptionId,
            );

            if (subscription.status === "live") {
                return createHttpConflictErrorResponse("Consumer subscription ID is already live");
            }

            PK = subscription.PK;
        } catch (e) {
            if (e instanceof SubscriptionIdNotFoundError) {
                PK = randomUUID();
            } else {
                throw e;
            }
        }

        logger.subscriptionId = PK;

        const producerSubscriptions = await getAvlSubscriptions(AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME);

        for (const producerSubscriptionId of subscriptionId) {
            const subscription = producerSubscriptions.find(({ PK }) => PK === producerSubscriptionId);

            if (!subscription || subscription.status === "inactive") {
                return createHttpNotFoundErrorResponse(`Producer subscription ID not found: ${producerSubscriptionId}`);
            }
        }

        const consumerSubscription: AvlConsumerSubscription = {
            PK,
            SK: userId,
            subscriptionId: consumerSubscriptionId,
            status: "live",
            url: subscriptionRequest.ConsumerAddress,
            requestorRef: subscriptionRequest.RequestorRef,
            updateInterval: updateInterval,
            heartbeatInterval: subscriptionRequest.SubscriptionContext.HeartbeatInterval,
            initialTerminationTime: subscriptionRequest.VehicleMonitoringSubscriptionRequest.InitialTerminationTime,
            requestTimestamp: subscriptionRequest.RequestTimestamp,
            heartbeatAttempts: 0,
            lastRetrievedAvlId: 0,
            queueUrl: "",
            eventSourceMappingUuid: "",
            scheduleName: "",
            queryParams: {
                boundingBox,
                operatorRef,
                vehicleRef,
                lineRef,
                producerRef,
                originRef,
                destinationRef,
                subscriptionId,
            },
        };

        const queueUrl = await createQueue({
            QueueName: `consumer-sub-queue-${consumerSubscription.PK}`,
            Attributes: {
                VisibilityTimeout: "60",
            },
        });

        const queueAttributes = await getQueueAttributes({
            QueueUrl: queueUrl,
            AttributeNames: ["QueueArn"],
        });

        const eventSourceMappingUuid = await createEventSourceMapping({
            EventSourceArn: queueAttributes?.QueueArn,
            FunctionName: AVL_CONSUMER_SUBSCRIPTION_DATA_SENDER_FUNCTION_ARN,
        });

        const queueMessage: AvlSubscriptionTriggerMessage = {
            subscriptionPK: consumerSubscription.PK,
            SK: consumerSubscription.SK,
            frequencyInSeconds: getDuration(
                updateInterval,
            ).asSeconds() as AvlSubscriptionTriggerMessage["frequencyInSeconds"],
            queueUrl,
        };

        const scheduleName = `consumer-sub-schedule-${consumerSubscription.PK}`;

        await createSchedule({
            Name: scheduleName,
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

        consumerSubscription.queueUrl = queueUrl;
        consumerSubscription.eventSourceMappingUuid = eventSourceMappingUuid;
        consumerSubscription.scheduleName = scheduleName;

        await putDynamoItem(
            AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
            consumerSubscription.PK,
            consumerSubscription.SK,
            cleanDeep(consumerSubscription, { emptyStrings: false }),
        );

        return createHttpSuccessResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, `Invalid SIRI-VM XML provided: ${e.message}`);
            return createHttpValidationErrorResponse([e.message]);
        }

        if (e instanceof Error) {
            // Our AWS package versions do not support instanceof exception checks
            if (e.name === "QueueDeletedRecently") {
                logger.warn(e, "Queue deleted too recently when trying to resubscribe");
                return createHttpServiceUnavailableErrorResponse(
                    "Existing subscription is still deactivating, try again later",
                    60,
                );
            }

            if (e.name === "TooManyRequestsException") {
                logger.warn(e, "Hit AWS throttle limit when trying to subscribe");
                return createHttpTooManyRequestsErrorResponse("Too many subscribe requests, try again later", 60);
            }

            logger.error(e, "There was a problem with the avl-consumer-subscriber endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
