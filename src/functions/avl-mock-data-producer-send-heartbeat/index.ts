import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getMockDataProducerSubscriptions } from "@bods-integrated-data/shared/utils";
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

                const res = await fetch(url, {
                    method: "POST",
                    body: HeartbeatNotification,
                });

                if (!res.ok) {
                    logger.error(`Unable to send Heartbeat to: ${url}`);
                    return;
                }

                logger.info(`Successfully sent Heartbeat to: ${url}`);
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);

            throw e;
        }

        throw e;
    }
};
