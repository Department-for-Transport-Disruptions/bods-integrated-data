import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createUnauthorizedErrorResponse,
    createValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/avl/unsubscribe";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { deleteParameters } from "@bods-integrated-data/shared/ssm";
import { isPrivateAddress } from "@bods-integrated-data/shared/utils";
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

    await deleteParameters([`/subscription/${subscriptionId}/username`, `/subscription/${subscriptionId}/password`]);
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { TABLE_NAME: tableName, AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn } = process.env;

        if (!tableName || !avlProducerApiKeyArn) {
            throw new Error("Missing env vars: TABLE_NAME and AVL_PRODUCER_API_KEY_ARN must be set.");
        }

        await validateApiKey(avlProducerApiKeyArn, event.headers);

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);
        logger.subscriptionId = subscriptionId;

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
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
            await sendTerminateSubscriptionRequest(
                subscriptionId,
                subscriptionDetail,
                isPrivateAddress(subscription.url),
            );
        } catch (e) {
            await putMetricData("custom/AVLMetrics", [
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

        return {
            statusCode: 204,
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

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error("Subscription not found", e);
            return createNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the AVL unsubscribe endpoint", e);
        }

        return createServerErrorResponse();
    }
};
