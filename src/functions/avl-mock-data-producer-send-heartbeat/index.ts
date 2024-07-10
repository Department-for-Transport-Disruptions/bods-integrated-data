import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { getMockDataProducerSubscriptions } from "@bods-integrated-data/shared/utils";
import axios from "axios";
import { generateMockHeartbeat } from "./mockHeartbeatNotification";

export const handler = async () => {
    try {
        const { STAGE: stage, DATA_ENDPOINT: dataEndpoint, TABLE_NAME: tableName } = process.env;

        const currentTime = getDate().toISOString();

        if (!stage || !dataEndpoint || !tableName) {
            throw new Error("Missing env vars: STAGE, DATA_ENDPOINT and TABLE_NAME must be set");
        }

        const subscriptions = await getMockDataProducerSubscriptions(tableName);

        if (!subscriptions) {
            logger.info("No mock data producers are currently active.");
            return;
        }

        return Promise.all(
            subscriptions.map(async (subscription) => {
                const url =
                    stage === "local"
                        ? `${dataEndpoint}?subscriptionId=${subscription.subscriptionId}&apiKey=${subscription.apiKey}`
                        : `${dataEndpoint}/${subscription.subscriptionId}?apiKey=${subscription.apiKey}`;

                const HeartbeatNotification = generateMockHeartbeat(subscription.subscriptionId, currentTime);

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
            logger.error("There was an error when sending a Heartbeat Notification", e);
        }

        throw e;
    }
};
