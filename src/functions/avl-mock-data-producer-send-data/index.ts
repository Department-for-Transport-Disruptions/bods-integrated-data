import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared/dates";
import { recursiveScan } from "@bods-integrated-data/shared/dynamo";
import axios from "axios";
import { z } from "zod";
import { generateMockSiriVm } from "./mockSiriVm";
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

                await axios.post<string>(url, {
                    method: "POST",
                    data: siriVm,
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
