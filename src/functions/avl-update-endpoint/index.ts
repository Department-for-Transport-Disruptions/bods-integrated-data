import { logger } from "@baselime/lambda-logger";
import {
    addSubscriptionAuthCredsToSsm,
    sendSubscriptionRequestAndUpdateDynamo,
} from "@bods-integrated-data/shared/avl/subscribe";
import { sendTerminateSubscriptionRequestAndUpdateDynamo } from "@bods-integrated-data/shared/avl/unsubscribe";
import { getDynamoItem } from "@bods-integrated-data/shared/dynamo";
import {
    AvlSubscription,
    avlSubscriptionSchema,
    avlUpdateBodySchema,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const getSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<AvlSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        return null;
    }

    return avlSubscriptionSchema.parse(subscription);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

        const subscription = await getSubscription(subscriptionId, tableName);

        if (!subscription) {
            logger.info(`Subscription with ID: ${subscriptionId} not found in subscription table`);
            return {
                statusCode: 404,
                body: `Subscription with ID: ${subscriptionId} not found in subscription table.`,
            };
        }

        logger.info(`Starting lambda to update subscription with ID: ${subscriptionId}`);

        const subscriptionDetail: Omit<AvlSubscription, "PK" | "status"> = {
            url: updateBody.dataProducerEndpoint,
            description: updateBody.description ?? subscription.description,
            shortDescription: updateBody.shortDescription ?? subscription.shortDescription,
            requestorRef: subscription.requestorRef,
            publisherId: subscription.publisherId,
            serviceStartDatetime: subscription.serviceStartDatetime,
            lastModifiedDateTime: subscription.lastModifiedDateTime ?? null,
        };

        try {
            logger.info(`Unsubscribing from subscription ID: ${subscriptionId} using existing credentials `);
            await sendTerminateSubscriptionRequestAndUpdateDynamo(subscriptionId, subscriptionDetail, tableName);
        } catch (e) {
            logger.warn(
                `An error occurred when trying to unsubscribe from subscription with ID: ${subscriptionId}. Error ${e}`,
            );
        }

        await addSubscriptionAuthCredsToSsm(subscriptionId, updateBody.username, updateBody.password);

        logger.info(`Subscribing to subscription ID: ${subscriptionId} using new details`);
        await sendSubscriptionRequestAndUpdateDynamo(
            subscriptionId,
            subscriptionDetail,
            username,
            password,
            tableName,
            dataEndpoint,
            mockProducerSubscribeEndpoint,
        );

        logger.info(`Successfully updated subscription ID: ${subscriptionId}`);
        return {
            statusCode: 204,
            body: "",
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(
                `An error occurred when updating subscription ID: ${event.pathParameters?.subscriptionId ?? ""}`,
                e,
            );
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};
