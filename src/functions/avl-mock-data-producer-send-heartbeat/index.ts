import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { recursiveScan } from "@bods-integrated-data/shared/dynamo";
import { z } from "zod";
import { generateMockHeartbeat } from "./mockHeartbeatNotification";
import { subscriptionSchema } from "./subscription.schema";

const getMockDataProducerSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions || subscriptions.length === 0) {
        return null;
    }

    const parsedSubscriptions = z.array(subscriptionSchema).parse(subscriptions);

    return parsedSubscriptions.filter(
        (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "ACTIVE",
    );
};

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
