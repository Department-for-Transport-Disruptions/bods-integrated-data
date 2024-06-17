import { logger } from "@baselime/lambda-logger";
import { getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { avlSubscribeMessageSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const { TABLE_NAME: tableName, STAGE: stage } = process.env;

        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME.");
        }

        logger.info("Starting AVL subscriber");

        const subscriptionId = event.pathParameters?.subscriptionId;

        if (!subscriptionId) {
            throw new Error("Subscription ID must be passed as a path parameter");
        }

        if (!event.body) {
            throw new Error("No body sent with event");
        }

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            throw new Error("Invalid subscribe message from event body.");
        }

        const subscriptions = await getAvlSubscription(subscriptionId, tableName);

        if (!subscriptions) {
            logger.info(`Subscription with ID: ${subscriptionId} not found in subscription table`);
        }

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
