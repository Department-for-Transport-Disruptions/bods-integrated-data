import {
    createHttpNoContentResponse,
    createHttpServerErrorResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { deleteParameters } from "@bods-integrated-data/shared/ssm";
import { sendTerminateSubscriptionRequest } from "@bods-integrated-data/shared/unsubscribe";
import { SubscriptionIdNotFoundError, isPrivateAddress } from "@bods-integrated-data/shared/utils";
import {
    InvalidApiKeyError,
    InvalidXmlError,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { AxiosError } from "axios";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

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
    withLambdaRequestTracker(event, context);

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
                "avl",
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
                    e.toJSON(),
                    `There was an error when sending the unsubscribe request to the data producer for subscription ${subscriptionId}`,
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
            logger.warn(e, "Invalid SIRI-VM XML provided by the data producer");
            return createHttpValidationErrorResponse(["Invalid SIRI-VM XML provided by the data producer"]);
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            // We return a 200 here as only BODS can access our API and in the event that a subscription exists on BODS but
            // is not found in the IAVL service we want to return a success response so BODS can still deactivate a feed on their end.
            return createHttpNoContentResponse();
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the AVL unsubscribe endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
