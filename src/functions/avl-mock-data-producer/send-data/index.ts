import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared/dates";
import { recursiveScan } from "@bods-integrated-data/shared/dynamo";
import { z } from "zod";
import { generateMockSiriVm } from "./mockSiriVm";
import { subscriptionSchema } from "./subscription.schema";

const getMockDataProducerSubscriptions = async (stage: string) => {
    const subscriptions = await recursiveScan({
        TableName: `integrated-data-avl-subscription-table-${stage}`,
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
        const { STAGE: stage, DATA_ENDPOINT: dataEndpoint } = process.env;

        const currentTimestamp = getDate().toISOString();
        // ValidUntilTime for a SIRI-VM is defined as 5 minutes after the current time
        const validUntilTime = addIntervalToDate(currentTimestamp, 5, "minutes").toISOString();

        if (!stage || !dataEndpoint) {
            throw new Error("Missing env vars: STAGE and DATA_ENDPOINT must be set");
        }

        const subscriptions = await getMockDataProducerSubscriptions(stage);

        if (!subscriptions) {
            logger.info("No mock data producers are currently active.");
            return;
        }

        return Promise.all(
            subscriptions.map(async (subscription) => {
                const url =
                    stage === "local"
                        ? `${dataEndpoint}?subscriptionId=${subscription.subscriptionId}`
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
