import {
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpSuccessResponse,
    createHttpValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    getAvlConsumerSubscription,
    getAvlConsumerSubscriptions,
} from "@bods-integrated-data/shared/avl-consumer/utils";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerQueryParams, AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestHeadersSchema = z.object({
    "x-user-id": createStringLengthValidation("x-user-id header"),
});

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: z.union([createStringLengthValidation("subscriptionId"), z.literal("")]).optional(),
    }),
);

export type ApiAvlConsumerSubscription = {
    id: string;
    subscriptionId: string;
    status: string;
    url: string;
    requestorRef: string;
    updateInterval: string;
    heartbeatInterval: string;
    initialTerminationTime: string;
    requestTimestamp: string;
    queryParams: AvlConsumerQueryParams;
};

export const mapApiAvlSubscriptionResponse = (subscription: AvlConsumerSubscription): ApiAvlConsumerSubscription => {
    return {
        id: subscription.PK,
        subscriptionId: subscription.subscriptionId,
        status: subscription.status,
        url: subscription.url,
        requestorRef: subscription.requestorRef,
        updateInterval: subscription.updateInterval,
        heartbeatInterval: subscription.heartbeatInterval,
        initialTerminationTime: subscription.initialTerminationTime,
        requestTimestamp: subscription.requestTimestamp,
        queryParams: subscription.queryParams,
    };
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME } = process.env;

        if (!AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME) {
            throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
        }

        const headers = requestHeadersSchema.parse(event.headers);
        const userId = headers["x-user-id"];

        const { subscriptionId } = requestParamsSchema.parse(event.queryStringParameters);

        let response = null;

        if (subscriptionId) {
            const subscription = await getAvlConsumerSubscription(
                AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
                userId,
                subscriptionId,
            );
            logger.subscriptionId = subscription.PK;
            response = mapApiAvlSubscriptionResponse(subscription);
        } else {
            const subscriptions = await getAvlConsumerSubscriptions(AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME, userId);
            response = subscriptions.map(mapApiAvlSubscriptionResponse);
        }

        return createHttpSuccessResponse(JSON.stringify(response));
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createHttpNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-subscriptions endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
