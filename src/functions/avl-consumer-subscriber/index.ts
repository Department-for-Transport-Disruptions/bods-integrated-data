import {
    createConflictErrorResponse,
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createSuccessResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { isActiveAvlConsumerSubscription } from "@bods-integrated-data/shared/avl-consumer/utils";
import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription, avlSubscriptionRequestSchema } from "@bods-integrated-data/shared/schema";
import { InvalidXmlError, createSubscriptionIdArrayValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

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

        const requestParams = requestParamsSchema.parse(event.queryStringParameters);
        const body = requestBodySchema.parse(event.body);
        const xml = parseXml(body);
        const subscriptionRequest = xml.Siri.SubscriptionRequest;

        const isActiveAvlSubscription = await isActiveAvlConsumerSubscription(
            avlConsumerSubscriptionTableName,
            subscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier,
        );

        if (isActiveAvlSubscription) {
            return createConflictErrorResponse("Consumer subscription ID already active");
        }

        const subscriptionIds = requestParams.subscriptionId.split(",");

        const producerSubscriptions = await getAvlSubscriptions(avlProducerSubscriptionTableName);

        for (const subscriptionId of subscriptionIds) {
            const subscription = producerSubscriptions.find(({ PK }) => PK === subscriptionId);

            if (!subscription || subscription.status === "inactive") {
                return createNotFoundErrorResponse(`Producer subscription ID not found: ${subscriptionId}`);
            }
        }

        const newConsumerSubscription: AvlConsumerSubscription = {
            subscriptionId: subscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier,
            status: "live",
            url: subscriptionRequest.ConsumerAddress,
            requestorRef: subscriptionRequest.RequestorRef,
            heartbeatInterval: subscriptionRequest.SubscriptionContext.HeartbeatInterval,
            initialTerminationTime: subscriptionRequest.VehicleMonitoringSubscriptionRequest.InitialTerminationTime,
            requestTimestamp: subscriptionRequest.RequestTimestamp,
            subscriptionIds,
        };

        await putDynamoItem(
            avlConsumerSubscriptionTableName,
            newConsumerSubscription.subscriptionId,
            "SUBSCRIPTION",
            newConsumerSubscription,
        );

        return createSuccessResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn("Invalid SIRI-VM XML provided", e);
            return createValidationErrorResponse(["Invalid SIRI-VM XML provided"]);
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the avl-consumer-subscriber endpoint", e);
        }

        return createServerErrorResponse();
    }
};
