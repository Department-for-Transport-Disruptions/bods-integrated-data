import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { sendTerminateSubscriptionRequestAndUpdateDynamo } from "@bods-integrated-data/shared/avl/unsubscribe";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { logger } from "@bods-integrated-data/shared/logger";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { deleteParameters } from "@bods-integrated-data/shared/ssm";
import { InvalidXmlError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { TABLE_NAME: tableName } = process.env;

        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME must be set.");
        }

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);

        logger.info(`Starting AVL unsubscriber to unsubscribe from subscription: ${subscriptionId}`);

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
            url: subscription.url,
            description: subscription.description,
            shortDescription: subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
            serviceStartDatetime: subscription.serviceStartDatetime,
            lastModifiedDateTime: subscription.lastModifiedDateTime,
        };
        try {
            await sendTerminateSubscriptionRequestAndUpdateDynamo(subscriptionId, subscriptionDetail, tableName);
        } catch (e) {
            await putMetricData("custom/CAVLMetrics", [
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

            throw e;
        }

        await deleteSubscriptionAuthCredsFromSsm(subscriptionId);

        logger.info(`Successfully unsubscribed to data producer with subscription ID: ${subscriptionId}.`);

        return {
            statusCode: 204,
            body: "",
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
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
