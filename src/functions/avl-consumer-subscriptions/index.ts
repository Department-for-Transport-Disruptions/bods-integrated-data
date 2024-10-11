import {
    createHttpServerErrorResponse,
    createHttpSuccessResponse,
    createHttpValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { getAvlConsumerSubscriptions } from "@bods-integrated-data/shared/avl-consumer/utils";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

const requestHeadersSchema = z.object({
    "x-user-id": createStringLengthValidation("x-user-id header"),
});

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME } = process.env;

        if (!AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME) {
            throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
        }

        const headers = requestHeadersSchema.parse(event.headers);
        const userId = headers["x-user-id"];
        const subscriptions = await getAvlConsumerSubscriptions(AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME, userId);

        return createHttpSuccessResponse(JSON.stringify(subscriptions));
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-subscriptions endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
