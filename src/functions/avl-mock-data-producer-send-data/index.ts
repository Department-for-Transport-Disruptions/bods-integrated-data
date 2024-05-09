import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared/dates";
import { getMockDataProducerSubscriptions } from "@bods-integrated-data/shared/utils";
import { generateMockSiriVm } from "./mockSiriVm";

export const handler = async () => {
    try {
        const { STAGE: stage, DATA_ENDPOINT: dataEndpoint, TABLE_NAME: tableName } = process.env;

        const currentTimestamp = getDate().toISOString();
        // ValidUntilTime for a SIRI-VM is defined as 5 minutes after the current time
        const validUntilTime = addIntervalToDate(currentTimestamp, 5, "minutes").toISOString();

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

                const siriVm = generateMockSiriVm(subscription.subscriptionId, currentTimestamp, validUntilTime);

                const res = await fetch(url, {
                    method: "POST",
                    body: siriVm,
                });

                if (!res.ok) {
                    logger.error(`Unable to send AVL data to: ${url}`);
                    return;
                }

                logger.info(`Successfully sent AVL data to: ${url}`);
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
