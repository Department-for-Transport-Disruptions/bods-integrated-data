import {
    createHttpNoContentResponse,
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
} from "@bods-integrated-data/shared/avl/subscribe";
import { getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription, avlUpdateBodySchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/unsubscribe";
import { SubscriptionIdNotFoundError, generateApiKey, isPrivateAddress } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

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

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const {
            STAGE: stage,
            TABLE_NAME: tableName,
            MOCK_PRODUCER_SUBSCRIBE_ENDPOINT: mockProducerSubscribeEndpoint,
            DATA_ENDPOINT: dataEndpoint,
            INTERNAL_DATA_ENDPOINT: internalDataEndpoint,
            AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn,
        } = process.env;

        if (!tableName || !dataEndpoint || !avlProducerApiKeyArn) {
            throw new Error("Missing env vars: TABLE_NAME, DATA_ENDPOINT and AVL_PRODUCER_API_KEY_ARN must be set.");
        }

        if (stage === "local" && !mockProducerSubscribeEndpoint) {
            throw new Error("Missing env var: MOCK_PRODUCER_SUBSCRIBE_ENDPOINT must be set when STAGE === local");
        }

        await validateApiKey(avlProducerApiKeyArn, event.headers);

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);
        logger.subscriptionId = subscriptionId;

        const updateBody = requestBodySchema.parse(event.body);
        const { username, password } = updateBody;

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        const isInternal = isPrivateAddress(updateBody.dataProducerEndpoint);

        if (isInternal && !internalDataEndpoint) {
            throw new Error("No internal data endpoint set for internal data producer endpoint");
        }

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
            url: updateBody.dataProducerEndpoint,
            description: updateBody.description ?? subscription.description,
            shortDescription: updateBody.shortDescription ?? subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
            serviceStartDatetime: subscription.serviceStartDatetime,
            lastModifiedDateTime: getDate().toISOString(),
            apiKey: subscription.apiKey || generateApiKey(),
        };

        try {
            logger.info("Unsubscribing using existing credentials ");
            await sendTerminateSubscriptionRequest("avl", subscriptionId, subscriptionDetail, isInternal);
        } catch (e) {
            logger.warn(
                `An error occurred when trying to unsubscribe from subscription with ID: ${subscriptionId}. Error ${e}`,
            );
        }

        await addSubscriptionAuthCredsToSsm(subscriptionId, updateBody.username, updateBody.password);

        logger.info("Subscribing using new details");

        await sendSubscriptionRequestAndUpdateDynamo(
            subscriptionId,
            subscriptionDetail,
            username,
            password,
            tableName,
            isInternal && internalDataEndpoint ? `http://${internalDataEndpoint}` : dataEndpoint,
            isInternal,
            mockProducerSubscribeEndpoint,
        );

        return createHttpNoContentResponse();
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
