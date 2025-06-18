import {
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { getAvlSubscription, getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import { createStringLengthValidation, InvalidApiKeyError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: z.union([createStringLengthValidation("subscriptionId"), z.literal("")]).optional(),
    }),
);

export type ApiAvlSubscription = {
    id: string;
    publisherId: string | null;
    status: string;
    lastAvlDataReceivedDateTime: string | null;
    heartbeatLastReceivedDateTime: string | null;
    serviceStartDatetime: string | null;
    serviceEndDatetime: string | null;
    apiKey: string;
};

export const mapApiAvlSubscriptionResponse = (subscription: AvlSubscription): ApiAvlSubscription => {
    return {
        id: subscription.PK,
        publisherId: subscription.publisherId || null,
        status: subscription.status,
        lastAvlDataReceivedDateTime: subscription.lastAvlDataReceivedDateTime || null,
        heartbeatLastReceivedDateTime: subscription.heartbeatLastReceivedDateTime || null,
        serviceStartDatetime: subscription.serviceStartDatetime || null,
        serviceEndDatetime: subscription.serviceEndDatetime || null,
        apiKey: subscription.apiKey,
    };
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { TABLE_NAME: tableName, AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn } = process.env;

        if (!tableName || !avlProducerApiKeyArn) {
            throw new Error("Missing env vars - TABLE_NAME and AVL_PRODUCER_API_KEY_ARN must be set");
        }

        await validateApiKey(avlProducerApiKeyArn, event.headers);

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);

        let response = null;

        if (subscriptionId) {
            const subscription = await getAvlSubscription(subscriptionId, tableName);
            logger.subscriptionId = subscription.PK;
            response = mapApiAvlSubscriptionResponse(subscription);
        } else {
            const subscriptions = await getAvlSubscriptions(tableName);
            response = subscriptions.map(mapApiAvlSubscriptionResponse);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createHttpUnauthorizedErrorResponse();
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createHttpNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the AVL subscriptions endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
