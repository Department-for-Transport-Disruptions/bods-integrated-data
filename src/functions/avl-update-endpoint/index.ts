import { logger } from "@baselime/lambda-logger";
import { getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { AvlSubscription, avlUpdateBodySchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import axios, { AxiosError } from "axios";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
} from "@bods-integrated-data/shared/avl/subscribe";

const unsubscribeFromExistingSubscription = async (subscriptionId: string, url: string) => {
    const unsubscribeUrl = `${url}/${subscriptionId}`;

    try {
        logger.info(`Unsubscribing from subscription ID: ${subscriptionId}`);

        await axios.post(unsubscribeUrl);

        logger.info(`Successfully unsubscribed from subscription ID: ${subscriptionId}`);
    } catch (e) {
        if (e instanceof AxiosError) {
            //TODO: should this be logger.error instead?
            logger.warn(
                `There was an error when attempting to unsubscribe from subscription ID: ${subscriptionId} - code: ${e.code}, message: ${e.message}`,
            );
        } else {
            throw e;
        }
    }
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const {
            STAGE: stage,
            TABLE_NAME: tableName,
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

        const subscriptionId = event.pathParameters?.subscriptionId;

        if (!subscriptionId) {
            throw new Error("Subscription ID must be passed as a path parameter");
        }

        if (!event.body) {
            throw new Error("No body sent with event");
        }

        const parsedBody = avlUpdateBodySchema.safeParse(JSON.parse(event.body));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            throw new Error("Invalid event body for updating subscription.");
        }

        const updateBody = parsedBody.data;
        const { username, password } = updateBody;

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        if (!subscription) {
            logger.info(`Subscription with ID: ${subscriptionId} not found in subscription table`);
        }

        logger.info(`Starting lambda to update subscription with ID: ${subscriptionId}`);

        // await unsubscribeFromExistingSubscription(subscriptionId, unsubscribeEndpoint);

        await addSubscriptionAuthCredsToSsm(subscriptionId, updateBody.username, updateBody.password);

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
            url: updateBody.dataProducerEndpoint,
            description: updateBody.description ?? subscription.description,
            shortDescription: updateBody.shortDescription ?? subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
        };

        await sendSubscriptionRequestAndUpdateDynamo(
            subscriptionId,
            subscriptionDetail,
            username,
            password,
            tableName,
            dataEndpoint,
            mockProducerSubscribeEndpoint,
        );

        return {
            statusCode: 204,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);
        }

        throw e;
    }
};
