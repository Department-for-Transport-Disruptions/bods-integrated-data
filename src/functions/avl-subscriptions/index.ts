import { logger } from "@baselime/lambda-logger";
import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    SubscriptionIdNotFoundError,
    getAvlSubscription,
    getAvlSubscriptions,
} from "@bods-integrated-data/shared/avl/utils";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, z } from "zod";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createStringLengthValidation("subscriptionId").optional(),
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
    };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { TABLE_NAME: tableName } = process.env;

        if (!tableName) {
            throw new Error("Missing env vars - TABLE_NAME must be set");
        }

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);

        let response = null;

        if (subscriptionId) {
            const subscription = await getAvlSubscription(subscriptionId, tableName);
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
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error("Subscription not found", e);
            return createNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the AVL subscriptions endpoint", e);
        }

        return createServerErrorResponse();
    }
};
