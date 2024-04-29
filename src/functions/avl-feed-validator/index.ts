import { logger } from "@baselime/lambda-logger";
import { recursiveScan } from "@bods-integrated-data/shared/dynamo";
import { subscriptionsSchema } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { getDate } from "@bods-integrated-data/shared/dates";

export const getSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions || subscriptions.length === 0) {
        return null;
    }

    const parsedSubscriptions = subscriptionsSchema.parse(subscriptions);

    return parsedSubscriptions.filter((subscription) => subscription.status !== "TERMINATED");
};

export const handler = async () => {
    try {
        const { STAGE: stage, TABLE_NAME: tableName } = process.env;

        if (!stage || !tableName) {
            throw new Error("Missing env vars: STAGE and TABLE_NAME must be set");
        }

        const subscriptions = await getSubscriptions(tableName);

        if (!subscriptions) {
            logger.info("No subscriptions found in DynamoDb to validate");
            return;
        }

        subscriptions.forEach((subscription) => {
            const isHeartbeatValid = getDate(subscription.heartbeatLastReceivedDateTime ?? subscription.)
        });
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);

            throw e;
        }

        throw e;
    }
};
