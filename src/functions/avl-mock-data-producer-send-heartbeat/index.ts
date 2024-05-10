import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getMockDataProducerSubscriptions } from "@bods-integrated-data/shared/utils";
import axios from "axios";
import { generateMockHeartbeat } from "./mockHeartbeatNotification";

export const handler = async () => {
    try {
        const { STAGE: stage, DATA_ENDPOINT: dataEndpoint, TABLE_NAME: tableName } = process.env;

        const currentTimestamp = getDate().toISOString();

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
                        ? `${dataEndpoint}?subscription_id=${subscription.subscriptionId}`
                        : `${dataEndpoint}/${subscription.subscriptionId}`;

                const HeartbeatNotification = generateMockHeartbeat(subscription.subscriptionId, currentTimestamp);

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

            throw e;
        }

        throw e;
    }
};
