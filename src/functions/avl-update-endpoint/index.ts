import { logger } from "@baselime/lambda-logger";
import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
} from "@bods-integrated-data/shared/avl/subscribe";
import { sendTerminateSubscriptionRequestAndUpdateDynamo } from "@bods-integrated-data/shared/avl/unsubscribe";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { AvlSubscription, avlUpdateBodySchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, z } from "zod";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createStringLengthValidation("subscriptionId"),
    }),
);

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(avlUpdateBodySchema);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const {
            STAGE: stage,
            TABLE_NAME: tableName,
            MOCK_PRODUCER_SUBSCRIBE_ENDPOINT: mockProducerSubscribeEndpoint,
            DATA_ENDPOINT: dataEndpoint,
        } = process.env;

        if (!tableName || !dataEndpoint) {
            throw new Error("Missing env vars: TABLE_NAME and DATA_ENDPOINT must be set.");
        }

        if (stage === "local" && !mockProducerSubscribeEndpoint) {
            throw new Error("Missing env var: MOCK_PRODUCER_SUBSCRIBE_ENDPOINT must be set when STAGE === local");
        }

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);

        if (!event.body) {
            throw new Error("No body sent with event");
        }

        const updateBody = requestBodySchema.parse(event.body);
        const { username, password } = updateBody;

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        logger.info(`Starting lambda to update subscription with ID: ${subscriptionId}`);

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
            url: updateBody.dataProducerEndpoint,
            description: updateBody.description ?? subscription.description,
            shortDescription: updateBody.shortDescription ?? subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
            serviceStartDatetime: subscription.serviceStartDatetime,
            lastModifiedDateTime: subscription.lastModifiedDateTime ?? null,
        };

        try {
            logger.info(`Unsubscribing from subscription ID: ${subscriptionId} using existing credentials `);
            await sendTerminateSubscriptionRequestAndUpdateDynamo(subscriptionId, subscriptionDetail, tableName);
        } catch (e) {
            logger.warn(
                `An error occurred when trying to unsubscribe from subscription with ID: ${subscriptionId}. Error ${e}`,
            );
        }

        await addSubscriptionAuthCredsToSsm(subscriptionId, updateBody.username, updateBody.password);

        logger.info(`Subscribing to subscription ID: ${subscriptionId} using new details`);
        logger.info("subscriptionDetail", subscriptionDetail);
        await sendSubscriptionRequestAndUpdateDynamo(
            subscriptionId,
            subscriptionDetail,
            username,
            password,
            tableName,
            dataEndpoint,
            mockProducerSubscribeEndpoint,
        );

        logger.info(`Successfully updated subscription ID: ${subscriptionId}`);
        return {
            statusCode: 204,
            body: "",
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
