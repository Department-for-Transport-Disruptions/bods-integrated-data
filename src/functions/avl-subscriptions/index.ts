import { logger } from "@baselime/lambda-logger";
import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayProxyResultV2 } from "aws-lambda";

export type ApiAvlSubscription = {
    id: string;
    publisherId: string | null;
    status: string;
    lastAvlDataReceivedDateTime: string | null;
    heartbeatLastReceivedDateTime: string | null;
    serviceStartDatetime: string | null;
    serviceEndDatetime: string | null;
};

export const mapApiAvlSubscriptionResponse = (subscription: AvlSubscription): ApiAvlSubscription => {
    return {
        id: subscription.PK,
        publisherId: subscription.publisherId || null,
        status: subscription.status,
        lastAvlDataReceivedDateTime: subscription.lastAvlDataReceivedDateTime || null,
        heartbeatLastReceivedDateTime: subscription.heartbeatLastReceivedDateTime || null,
        serviceStartDatetime: subscription.serviceStartDatetime || null,
        serviceEndDatetime: subscription.serviceEndDatetime || null,
    };
};

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
    const { TABLE_NAME: tableName } = process.env;

    if (!tableName) {
        logger.error("Missing env vars - TABLE_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    try {
        const subscriptions = await getAvlSubscriptions(tableName);
        const apiAvlSubscriptionsResponse = subscriptions.map(mapApiAvlSubscriptionResponse);

        return {
            statusCode: 200,
            body: JSON.stringify(apiAvlSubscriptionsResponse),
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was an error retrieving AVL subscription data", error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};
