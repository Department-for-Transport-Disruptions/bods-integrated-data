import { logger } from "@baselime/lambda-logger";
import { isActiveAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import {
    AvlSubscribeMessage,
    avlSubscribeMessageSchema,
    AvlSubscription,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { AxiosError } from "axios";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
    updateDynamoWithSubscriptionInfo,
} from "@bods-integrated-data/shared/avl/subscribe";

const formatSubscriptionDetail = (
    avlSubscribeMessage: AvlSubscribeMessage,
): Omit<AvlSubscription, "PK" | "status"> => ({
    url: avlSubscribeMessage.dataProducerEndpoint,
    description: avlSubscribeMessage.description,
    shortDescription: avlSubscribeMessage.shortDescription,
    requestorRef: avlSubscribeMessage.requestorRef,
    publisherId: avlSubscribeMessage.publisherId,
});

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
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

        if (!event.body) {
            throw new Error("No body sent with event");
        }

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            throw new Error("Invalid subscribe message from event body.");
        }

        const avlSubscribeMessage = parsedBody.data;
        const { subscriptionId, username, password } = avlSubscribeMessage;

        const isActiveSubscription = await isActiveAvlSubscription(subscriptionId, tableName);

        if (isActiveSubscription) {
            return {
                statusCode: 409,
                body: "Subscription ID already active",
            };
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
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", e);
        }

        throw e;
    }
};
