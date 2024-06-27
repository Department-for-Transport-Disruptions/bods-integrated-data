import { logger } from "@baselime/lambda-logger";
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
import { AvlSubscribeMessage, AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { InvalidXmlError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AxiosError } from "axios";
import { ZodError, z } from "zod";

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(
        z.object(
            {
                dataProducerEndpoint: z
                    .string({
                        required_error: "dataProducerEndpoint is required",
                        invalid_type_error: "dataProducerEndpoint must be a string",
                    })
                    .url({
                        message: "dataProducerEndpoint must be a URL",
                    }),
                description: createStringLengthValidation("description"),
                shortDescription: createStringLengthValidation("shortDescription"),
                username: createStringLengthValidation("username"),
                password: createStringLengthValidation("password"),
                requestorRef: createStringLengthValidation("requestorRef").optional(),
                subscriptionId: createStringLengthValidation("subscriptionId"),
                publisherId: createStringLengthValidation("publisherId"),
            },
            {
                message: "Body must be an object with required properties",
            },
        ),
    );

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
