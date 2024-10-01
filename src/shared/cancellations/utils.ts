import { Dayjs } from "dayjs";
import { getDate, isDateAfter } from "../dates";
import { getDynamoItem, recursiveScan } from "../dynamo";
import {
    CancellationsSubscription,
    cancellationsSubscriptionSchema,
    cancellationsSubscriptionsSchema,
} from "../schema/cancellations-subscribe.schema";
import { SubscriptionIdNotFoundError } from "../utils";

export const getCancellationsSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions) {
        return [];
    }

    return cancellationsSubscriptionsSchema.parse(subscriptions);
};

export const getCancellationsSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<CancellationsSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return cancellationsSubscriptionSchema.parse(subscription);
};

/**
 * Checks if a given subscription is healthy by looking at whether any of heartbeatLastReceivedDateTime,
 * lastResubscriptionTime, serviceStartDatetime, or lastCancellationsDataReceivedDateTime were in the last 90 seconds.
 *
 * Data producers are meant to send heartbeats at least every 30 seconds but this is not always the case so the extra
 * checks are intended to prevent over re-subscribing
 *
 * @param subscription The subscription object to check
 * @param currentTime The current time in DayJs
 * @returns Whether the subscription is healthy or not
 */
export const checkCancellationsSubscriptionIsHealthy = (
    subscription: CancellationsSubscription,
    currentTime: Dayjs,
) => {
    const {
        heartbeatLastReceivedDateTime,
        lastResubscriptionTime,
        serviceStartDatetime,
        lastCancellationsDataReceivedDateTime,
    } = subscription;

    const heartbeatThreshold = currentTime.subtract(90, "seconds");

    const heartbeatLastReceivedInThreshold =
        heartbeatLastReceivedDateTime && isDateAfter(getDate(heartbeatLastReceivedDateTime), heartbeatThreshold);

    const lastResubscriptionTimeInThreshold =
        lastResubscriptionTime && isDateAfter(getDate(lastResubscriptionTime), heartbeatThreshold);

    const serviceStartDatetimeInThreshold =
        serviceStartDatetime && isDateAfter(getDate(serviceStartDatetime), heartbeatThreshold);

    const lastCancellationsDataReceivedDateTimeInThreshold =
        lastCancellationsDataReceivedDateTime &&
        isDateAfter(getDate(lastCancellationsDataReceivedDateTime), heartbeatThreshold);

    return !!(
        heartbeatLastReceivedInThreshold ||
        lastResubscriptionTimeInThreshold ||
        lastCancellationsDataReceivedDateTimeInThreshold ||
        serviceStartDatetimeInThreshold
    );
};
