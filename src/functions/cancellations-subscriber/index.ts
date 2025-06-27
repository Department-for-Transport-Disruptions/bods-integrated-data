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
} from "@bods-integrated-data/shared/cancellations/subscribe";
import { getCancellationsSubscription } from "@bods-integrated-data/shared/cancellations/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import {
    CancellationsSubscription,
    cancellationsSubscribeMessageSchema,
} from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import { SubscriptionIdNotFoundError, generateApiKey, isPrivateAddress } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(cancellationsSubscribeMessageSchema);

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const {
            TABLE_NAME: tableName,
            STAGE: stage,
            DATA_ENDPOINT: dataEndpoint,
            INTERNAL_DATA_ENDPOINT: internalDataEndpoint,
            CANCELLATIONS_PRODUCER_API_KEY_ARN: cancellationsProducerApiKeyArn,
            MOCK_PRODUCER_SUBSCRIBE_ENDPOINT: mockProducerSubscribeEndpoint,
        } = process.env;

        if (!tableName || !dataEndpoint || !cancellationsProducerApiKeyArn) {
            throw new Error(
                "Missing env vars: TABLE_NAME, DATA_ENDPOINT and CANCELLATIONS_PRODUCER_API_KEY_ARN must be set.",
            );
        }

        if (stage === "local" && !mockProducerSubscribeEndpoint) {
            throw new Error("Missing env var: MOCK_PRODUCER_SUBSCRIBE_ENDPOINT must be set when STAGE === local");
        }

        await validateApiKey(cancellationsProducerApiKeyArn, event.headers);

        const cancellationsSubscribeMessage = requestBodySchema.parse(event.body);

        const { subscriptionId, username, password } = cancellationsSubscribeMessage;
        logger.subscriptionId = subscriptionId;

        let activeSubscription: CancellationsSubscription | null = null;

        try {
            activeSubscription = await getCancellationsSubscription(subscriptionId, tableName);
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

        const isInternal = isPrivateAddress(cancellationsSubscribeMessage.dataProducerEndpoint);

        if (isInternal && !internalDataEndpoint) {
            throw new Error("No internal data endpoint set for internal data producer endpoint");
        }

        const currentTime = getDate().toISOString();

        const subscriptionDetails: Omit<CancellationsSubscription, "PK" | "status"> = {
            url: cancellationsSubscribeMessage.dataProducerEndpoint,
            description: cancellationsSubscribeMessage.description,
            shortDescription: cancellationsSubscribeMessage.shortDescription,
            requestorRef: cancellationsSubscribeMessage.requestorRef,
            publisherId: cancellationsSubscribeMessage.publisherId,
            apiKey: activeSubscription?.apiKey || generateApiKey(),
            heartbeatLastReceivedDateTime: activeSubscription?.heartbeatLastReceivedDateTime ?? null,
            lastCancellationsDataReceivedDateTime: activeSubscription?.lastCancellationsDataReceivedDateTime ?? null,
            serviceStartDatetime: activeSubscription?.serviceStartDatetime,
            lastResubscriptionTime: activeSubscription ? currentTime : null,
            lastModifiedDateTime: activeSubscription ? currentTime : null,
            operatorRefs: cancellationsSubscribeMessage.operatorRefs,
        };

        await sendSubscriptionRequestAndUpdateDynamo(
            subscriptionId,
            subscriptionDetails,
            cancellationsSubscribeMessage.username,
            cancellationsSubscribeMessage.password,
            tableName,
            isInternal && internalDataEndpoint ? `http://${internalDataEndpoint}` : dataEndpoint,
            isInternal,
            mockProducerSubscribeEndpoint,
        );

        logger.info(`Successfully subscribed to data producer: ${cancellationsSubscribeMessage.dataProducerEndpoint}.`);

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
            logger.error(e, "There was a problem with the cancellations subscriber endpoint");
        }

        await putMetricData("custom/CancellationsMetrics", [
            {
                MetricName: "FailedSubscription",
                Value: 1,
            },
        ]);

        return createHttpServerErrorResponse();
    }
};
