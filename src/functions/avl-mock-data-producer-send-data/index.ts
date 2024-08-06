import { getSiriVmValidUntilTimeOffset } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getMockDataProducerSubscriptions } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios from "axios";
import { generateMockSiriVm } from "./mockSiriVm";

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { STAGE: stage, DATA_ENDPOINT: dataEndpoint, TABLE_NAME: tableName } = process.env;

        const responseTime = getDate();
        const currentTime = responseTime.toISOString();
        const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);

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

                const siriVm = generateMockSiriVm(subscription.subscriptionId, currentTime, validUntilTime);

                await axios.post(url, siriVm, {
                    headers: {
                        "Content-Type": "text/xml",
                    },
                });

                logger.info(`Successfully sent AVL data to: ${url}`);
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error when sending AVL data", e);

            throw e;
        }

        throw e;
    }
};
