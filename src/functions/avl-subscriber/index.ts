import { randomUUID } from "node:crypto";
import {
    createConflictErrorResponse,
    createServerErrorResponse,
    createUnauthorizedErrorResponse,
    createValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
    updateDynamoWithSubscriptionInfo,
} from "@bods-integrated-data/shared/avl/subscribe";
import { isActiveAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { logger } from "@bods-integrated-data/shared/logger";
import { AvlSubscription, avlSubscribeMessageSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { isPrivateAddress } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AxiosError } from "axios";
import { ZodError, z } from "zod";

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(avlSubscribeMessageSchema);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const {
            TABLE_NAME: tableName,
            STAGE: stage,
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

        const avlSubscribeMessage = requestBodySchema.parse(event.body);
        const { subscriptionId, username, password } = avlSubscribeMessage;

        const isActiveSubscription = await isActiveAvlSubscription(subscriptionId, tableName);

        if (isActiveSubscription) {
            return createConflictErrorResponse("Subscription ID already active");
        }

        await addSubscriptionAuthCredsToSsm(subscriptionId, username, password);

        const isInternal = isPrivateAddress(avlSubscribeMessage.dataProducerEndpoint);

        if (isInternal && !internalDataEndpoint) {
            throw new Error("No internal data endpoint set for internal data producer endpoint");
        }

        const subscriptionDetails: Omit<AvlSubscription, "PK" | "status"> = {
            url: avlSubscribeMessage.dataProducerEndpoint,
            description: avlSubscribeMessage.description,
            shortDescription: avlSubscribeMessage.shortDescription,
            requestorRef: avlSubscribeMessage.requestorRef,
            publisherId: avlSubscribeMessage.publisherId,
            apiKey: randomUUID(),
        };

        try {
            await sendSubscriptionRequestAndUpdateDynamo(
                subscriptionId,
                subscriptionDetails,
                avlSubscribeMessage.username,
                avlSubscribeMessage.password,
                tableName,
                isInternal && internalDataEndpoint ? internalDataEndpoint : dataEndpoint,
                isInternal,
                mockProducerSubscribeEndpoint,
            );
        } catch (e) {
            if (e instanceof AxiosError) {
                await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "error");

                logger.error(
                    `There was an error when sending the subscription request to the data producer - subscriptionId: ${subscriptionId}, code: ${e.code}, message: ${e.message}`,
                );
            }
            await putMetricData("custom/AVLMetrics", [
                {
                    MetricName: "FailedSubscription",
                    Value: 1,
                },
            ]);
            throw e;
        }

        logger.info(`Successfully subscribed to data producer: ${avlSubscribeMessage.dataProducerEndpoint}.`);

        return {
            statusCode: 201,
            body: "",
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createUnauthorizedErrorResponse();
        }

        if (e instanceof InvalidXmlError) {
            logger.warn("Invalid SIRI-VM XML provided by the data producer", e);
            return createValidationErrorResponse(["Invalid SIRI-VM XML provided by the data producer"]);
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the AVL subscriber endpoint", e);
        }

        return createServerErrorResponse();
    }
};
