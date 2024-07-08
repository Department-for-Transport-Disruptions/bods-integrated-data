import {
    createConflictErrorResponse,
    createServerErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
    updateDynamoWithSubscriptionInfo,
} from "@bods-integrated-data/shared/avl/subscribe";
import { isActiveAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { logger } from "@bods-integrated-data/shared/logger";
import {
    AvlSubscribeMessage,
    AvlSubscription,
    avlSubscribeMessageSchema,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
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

const formatSubscriptionDetail = (
    avlSubscribeMessage: AvlSubscribeMessage,
): Omit<AvlSubscription, "PK" | "status"> => ({
    url: avlSubscribeMessage.dataProducerEndpoint,
    description: avlSubscribeMessage.description,
    shortDescription: avlSubscribeMessage.shortDescription,
    requestorRef: avlSubscribeMessage.requestorRef,
    publisherId: avlSubscribeMessage.publisherId,
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const {
            TABLE_NAME: tableName,
            STAGE: stage,
            MOCK_PRODUCER_SUBSCRIBE_ENDPOINT: mockProducerSubscribeEndpoint,
            DATA_ENDPOINT: dataEndpoint,
        } = process.env;

        if (!tableName || !dataEndpoint) {
            throw new Error("Missing env vars: TABLE_NAME and DATA_ENDPOINT must be set.");
        }

        if (stage === "local" && !mockProducerSubscribeEndpoint) {
            throw new Error("Missing env var: MOCK_PRODUCER_SUBSCRIBE_ENDPOINT must be set when STAGE === local");
        }

        logger.info("Starting AVL subscriber");

        const avlSubscribeMessage = requestBodySchema.parse(event.body);
        const { subscriptionId, username, password } = avlSubscribeMessage;

        const isActiveSubscription = await isActiveAvlSubscription(subscriptionId, tableName);

        if (isActiveSubscription) {
            return createConflictErrorResponse("Subscription ID already active");
        }

        await addSubscriptionAuthCredsToSsm(subscriptionId, username, password);

        try {
            const subscriptionDetails = formatSubscriptionDetail(avlSubscribeMessage);

            await sendSubscriptionRequestAndUpdateDynamo(
                subscriptionId,
                subscriptionDetails,
                avlSubscribeMessage.username,
                avlSubscribeMessage.password,
                tableName,
                dataEndpoint,
                mockProducerSubscribeEndpoint,
            );
        } catch (e) {
            if (e instanceof AxiosError) {
                await putMetricData("custom/CAVLMetrics", [
                    {
                        MetricName: "failedSubscription",
                        Value: 1,
                    },
                ]);
                const subscriptionDetails = formatSubscriptionDetail(avlSubscribeMessage);

                await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "ERROR");

                logger.error(
                    `There was an error when sending the subscription request to the data producer - code: ${e.code}, message: ${e.message}`,
                );
            }

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
