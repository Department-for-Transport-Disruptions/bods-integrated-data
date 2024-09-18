import { randomUUID } from "node:crypto";
import {
    createConflictErrorResponse,
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createSuccessResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { getAvlConsumerSubscription } from "@bods-integrated-data/shared/avl-consumer/utils";
import { SubscriptionIdNotFoundError, getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription, avlSubscriptionRequestSchema } from "@bods-integrated-data/shared/schema";
import {
    InvalidXmlError,
    createStringLengthValidation,
    createSubscriptionIdArrayValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

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
        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const {
            AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME: avlConsumerSubscriptionTableName,
            AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME: avlProducerSubscriptionTableName,
        } = process.env;

        if (!avlConsumerSubscriptionTableName || !avlProducerSubscriptionTableName) {
            throw new Error(
                "Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME and AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME must be set",
            );
        }

        const { userId } = requestHeadersSchema.parse(event.headers);
        const requestParams = requestParamsSchema.parse(event.queryStringParameters);
        const producerSubscriptionIds = requestParams.subscriptionId;

        const body = requestBodySchema.parse(event.body);
        const xml = parseXml(body);
        const subscriptionRequest = xml.Siri.SubscriptionRequest;
        const subscriptionId = subscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier;
        let PK = undefined;

        try {
            const subscription = await getAvlConsumerSubscription(
                avlConsumerSubscriptionTableName,
                subscriptionId,
                userId,
            );

            if (subscription.status === "live") {
                return createConflictErrorResponse("Consumer subscription ID is already live");
            }

            PK = subscription.PK;
        } catch (e) {
            if (e instanceof SubscriptionIdNotFoundError) {
                PK = undefined;
            } else {
                throw e;
            }
        }

        const producerSubscriptions = await getAvlSubscriptions(avlProducerSubscriptionTableName);

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
            avlConsumerSubscriptionTableName,
            consumerSubscription.PK,
            consumerSubscription.SK,
            consumerSubscription,
        );

        return createSuccessResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, "Invalid SIRI-VM XML provided");
            return createValidationErrorResponse(["Invalid SIRI-VM XML provided"]);
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-subscriber endpoint");
        }

        return createServerErrorResponse();
    }
};
