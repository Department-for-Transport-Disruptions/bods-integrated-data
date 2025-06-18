import {
    createHttpConflictErrorResponse,
    createHttpCreatedResponse,
    createHttpServerErrorResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
    updateDynamoWithSubscriptionInfo,
} from "@bods-integrated-data/shared/avl/subscribe";
import { getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription, avlSubscribeMessageSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { generateApiKey, isPrivateAddress, SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { AxiosError } from "axios";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(avlSubscribeMessageSchema);

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

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
        logger.subscriptionId = subscriptionId;

        let activeSubscription: AvlSubscription | null = null;

        try {
            activeSubscription = await getAvlSubscription(subscriptionId, tableName);
        } catch (e) {
            if (e instanceof SubscriptionIdNotFoundError) {
                activeSubscription = null;
            } else {
                throw e;
            }
        }

        if (activeSubscription?.status === "live") {
            return createHttpConflictErrorResponse("Subscription ID already active");
        }

        await addSubscriptionAuthCredsToSsm(subscriptionId, username, password);

        const isInternal = isPrivateAddress(avlSubscribeMessage.dataProducerEndpoint);

        if (isInternal && !internalDataEndpoint) {
            throw new Error("No internal data endpoint set for internal data producer endpoint");
        }

        const currentTime = getDate().toISOString();

        const subscriptionDetails: Omit<AvlSubscription, "PK" | "status"> = {
            url: avlSubscribeMessage.dataProducerEndpoint,
            description: avlSubscribeMessage.description,
            shortDescription: avlSubscribeMessage.shortDescription,
            requestorRef: avlSubscribeMessage.requestorRef,
            publisherId: avlSubscribeMessage.publisherId,
            apiKey: activeSubscription?.apiKey || generateApiKey(),
            heartbeatLastReceivedDateTime: activeSubscription?.heartbeatLastReceivedDateTime ?? null,
            lastAvlDataReceivedDateTime: activeSubscription?.lastAvlDataReceivedDateTime ?? null,
            serviceStartDatetime: activeSubscription?.serviceStartDatetime,
            lastResubscriptionTime: activeSubscription ? currentTime : null,
            lastModifiedDateTime: activeSubscription ? currentTime : null,
        };

        try {
            await sendSubscriptionRequestAndUpdateDynamo(
                subscriptionId,
                subscriptionDetails,
                avlSubscribeMessage.username,
                avlSubscribeMessage.password,
                tableName,
                isInternal && internalDataEndpoint ? `http://${internalDataEndpoint}` : dataEndpoint,
                isInternal,
                mockProducerSubscribeEndpoint,
            );
        } catch (e) {
            if (e instanceof AxiosError) {
                await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "error");

                logger.error(
                    e.toJSON(),
                    `There was an error when sending the subscription request to the data producer - subscriptionId: ${subscriptionId}`,
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

        return createHttpCreatedResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createHttpUnauthorizedErrorResponse();
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, "Invalid SIRI-VM XML provided by the data producer");
            return createHttpValidationErrorResponse(["Invalid SIRI-VM XML provided by the data producer"]);
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the AVL subscriber endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
