import { getAvlSubscriptions } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import axios from "axios";
import { generateMockHeartbeat } from "./mockHeartbeatNotification";

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { STAGE, AVL_DATA_ENDPOINT, AVL_TABLE_NAME } = process.env;

        const currentTime = getDate().toISOString();

        if (!STAGE || !AVL_DATA_ENDPOINT || !AVL_TABLE_NAME) {
            throw new Error("Missing env vars: STAGE, AVL_DATA_ENDPOINT and AVL_TABLE_NAME must be set");
        }

        let subscriptions = await getAvlSubscriptions(AVL_TABLE_NAME);
        subscriptions = subscriptions.filter(
            (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "live",
        );

        if (!subscriptions) {
            logger.info("No mock data producers are currently active.");
            return;
        }

        return Promise.all(
            subscriptions.map(async (subscription) => {
                const url =
                    STAGE === "local"
                        ? `${AVL_DATA_ENDPOINT}?subscriptionId=${subscription.PK}&apiKey=${subscription.apiKey}`
                        : `${AVL_DATA_ENDPOINT}/${subscription.PK}?apiKey=${subscription.apiKey}`;

                const HeartbeatNotification = generateMockHeartbeat(subscription.PK, currentTime);

                await axios.post(url, HeartbeatNotification, {
                    headers: {
                        "Content-Type": "text/xml",
                    },
                });

                logger.info(`Successfully sent Heartbeat Notification to: ${url}`);
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error when sending a Heartbeat Notification");
        }

        throw e;
    }
};
