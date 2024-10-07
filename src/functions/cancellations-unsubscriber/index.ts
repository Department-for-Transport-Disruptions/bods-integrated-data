import {
    createHttpNoContentResponse,
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { getCancellationsSubscription } from "@bods-integrated-data/shared/cancellations/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { CancellationsSubscription } from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import { deleteParameters } from "@bods-integrated-data/shared/ssm";
import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/unsubscribe";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import {
    InvalidApiKeyError,
    InvalidXmlError,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { AxiosError } from "axios";
import { ZodError, z } from "zod";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createStringLengthValidation("subscriptionId"),
    }),
);

const deleteSubscriptionAuthCredsFromSsm = async (subscriptionId: string) => {
    logger.info("Deleting subscription auth credentials from parameter store");

    await deleteParameters([
        `/cancellations/subscription/${subscriptionId}/username`,
        `/cancellations/subscription/${subscriptionId}/password`,
    ]);
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { TABLE_NAME: tableName, CANCELLATIONS_PRODUCER_API_KEY_ARN: cancellationsProducerApiKeyArn } =
            process.env;

        if (!tableName || !cancellationsProducerApiKeyArn) {
            throw new Error("Missing env vars: TABLE_NAME and AVL_PRODUCER_API_KEY_ARN must be set.");
        }

        await validateApiKey(cancellationsProducerApiKeyArn, event.headers);

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);
        logger.subscriptionId = subscriptionId;

        const subscription = await getCancellationsSubscription(subscriptionId, tableName);

        const subscriptionDetail: Omit<CancellationsSubscription, "PK" | "status"> = {
            url: subscription.url,
            description: subscription.description,
            shortDescription: subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
            serviceStartDatetime: subscription.serviceStartDatetime,
            lastModifiedDateTime: subscription.lastModifiedDateTime,
            apiKey: subscription.apiKey,
        };
        try {
            await sendTerminateSubscriptionRequest("cancellations", subscriptionId, subscriptionDetail, false);
        } catch (e) {
            await putMetricData("custom/CancellationsMetrics", [
                {
                    MetricName: "FailedUnsubscribeRequest",
                    Value: 1,
                },
            ]);
            if (e instanceof AxiosError) {
                logger.error(
                    `There was an error when sending the unsubscribe request to the data producer for subscription ${subscriptionId} - code: ${e.code}, message: ${e.message}`,
                );
            }
        }

        const currentTime = getDate().toISOString();

        await putDynamoItem(
            tableName,
            subscriptionId,
            "SUBSCRIPTION",

            {
                ...subscription,
                status: "inactive",
                serviceEndDatetime: currentTime,
                lastModifiedDateTime: currentTime,
            },
        );

        await deleteSubscriptionAuthCredsFromSsm(subscriptionId);

        return createHttpNoContentResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createHttpUnauthorizedErrorResponse();
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, "Invalid SIRI-SX XML provided by the data producer");
            return createHttpValidationErrorResponse(["Invalid SIRI-SX XML provided by the data producer"]);
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createHttpNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the cancellations unsubscribe endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
