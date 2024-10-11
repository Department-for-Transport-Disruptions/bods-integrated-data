import { randomUUID } from "node:crypto";
import { ALBEvent, APIGatewayProxyEvent } from "aws-lambda";
import { Dayjs } from "dayjs";
import { ZodSchema, z } from "zod";
import { fromZodError } from "zod-validation-error";
import { putMetricData } from "./cloudwatch";
import { RouteType, WheelchairAccessibility } from "./database";
import { getDate, isDateAfter } from "./dates";
import { logger } from "./logger";
import { CancellationsSubscription, VehicleType } from "./schema";
import { AvlSubscription } from "./schema/avl-subscribe.schema";
import { getParameter } from "./ssm";

export const chunkArray = <T>(array: T[], chunkSize: number) => {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
};

export const notEmpty = <T>(value: T | null | undefined): value is T => {
    return value !== null && value !== undefined;
};

export const getRouteTypeFromServiceMode = (mode?: string) => {
    switch (mode) {
        case "bus":
            return RouteType.Bus;
        case "coach":
            return RouteType.Coach;
        case "ferry":
            return RouteType.Ferry;
        case "metro":
            return RouteType.Metro;
        case "rail":
            return RouteType.Rail;
        case "tram":
            return RouteType.Tram;
        case "trolleyBus":
            return RouteType.TrolleyBus;
        case "underground":
            return RouteType.Underground;
        default:
            return RouteType.Bus;
    }
};

export const getWheelchairAccessibilityFromVehicleType = (vehicleType?: VehicleType, mode?: string) => {
    if (mode === "underground") {
        return WheelchairAccessibility.Accessible;
    }

    if (!vehicleType) {
        return WheelchairAccessibility.NoAccessibilityInformation;
    }

    const hasWheelchairEquipment = !!vehicleType.VehicleEquipment?.WheelchairEquipment;
    const numberOfWheelchairAreas = vehicleType.VehicleEquipment?.WheelchairEquipment?.NumberOfWheelchairAreas || 0;

    if (vehicleType.WheelchairAccessible || (hasWheelchairEquipment && numberOfWheelchairAreas > 0)) {
        return WheelchairAccessibility.Accessible;
    }

    if (vehicleType.WheelchairAccessible === false || (hasWheelchairEquipment && numberOfWheelchairAreas === 0)) {
        return WheelchairAccessibility.NotAccessible;
    }

    return WheelchairAccessibility.NoAccessibilityInformation;
};

export const txcSelfClosingProperty = z.literal("");
export const txcEmptyProperty = txcSelfClosingProperty.transform(() => undefined);

export const makeFilteredArraySchema = <T extends ZodSchema>(namespace: string, schema: T) =>
    z.preprocess((input): T[] => {
        const result = z.any().array().parse(input);

        return result.filter((item) => {
            const parsedItem = schema.safeParse(item);

            if (!parsedItem.success) {
                logger.warn(`Error parsing item: ${fromZodError(parsedItem.error).toString()}`);
                putMetricData(`custom/${namespace}`, [{ MetricName: "MakeFilteredArraySchemaParseError", Value: 1 }]);
            }

            return parsedItem.success;
        });
    }, z.array(schema));

export const getSubscriptionUsernameAndPassword = async (
    subscriptionId: string,
    subscriptionType: "avl" | "cancellations",
) => {
    const [subscriptionUsernameParam, subscriptionPasswordParam] = await Promise.all([
        getParameter(
            `${subscriptionType === "cancellations" ? "/cancellations" : ""}/subscription/${subscriptionId}/username`,
            true,
        ),
        getParameter(
            `${subscriptionType === "cancellations" ? "/cancellations" : ""}/subscription/${subscriptionId}/password`,
            true,
        ),
    ]);

    const subscriptionUsername = subscriptionUsernameParam.Parameter?.Value ?? null;
    const subscriptionPassword = subscriptionPasswordParam.Parameter?.Value ?? null;

    return {
        subscriptionUsername,
        subscriptionPassword,
    };
};

export const getCancellationsSubscriptionUsernameAndPassword = async (subscriptionId: string) => {
    const [subscriptionUsernameParam, subscriptionPasswordParam] = await Promise.all([
        getParameter(`/cancellations/subscription/${subscriptionId}/username`, true),
        getParameter(`/cancellations/subscription/${subscriptionId}/password`, true),
    ]);

    const subscriptionUsername = subscriptionUsernameParam.Parameter?.Value ?? null;
    const subscriptionPassword = subscriptionPasswordParam.Parameter?.Value ?? null;

    return {
        subscriptionUsername,
        subscriptionPassword,
    };
};

export const createAuthorizationHeader = (username: string, password: string) => {
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
};

export const isApiGatewayEvent = (event: APIGatewayProxyEvent | ALBEvent): event is APIGatewayProxyEvent =>
    !!(event as APIGatewayProxyEvent).pathParameters;

export const isPrivateAddress = (url: string) => {
    const privateIpRegex =
        /^(https?:\/\/)?(10(\.\d{1,3}){3}|172\.(1[6-9]|2[0-9]|3[0-1])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})(:\d+)?(\/.*)?$/;

    return privateIpRegex.test(url);
};

export const roundToDecimalPlaces = (number: number, precision: number) => +number.toFixed(precision);

export const generateApiKey = () => randomUUID().replaceAll("-", "");

export class SubscriptionIdNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SubscriptionIdNotFoundError";
        Object.setPrototypeOf(this, SubscriptionIdNotFoundError.prototype);
    }
}

export interface CompleteSiriObject<T> {
    "?xml": {
        "#text": "";
        "@_version": "1.0";
        "@_encoding": "UTF-8";
        "@_standalone": "yes";
    };
    Siri: {
        "@_version": "2.0";
        "@_xmlns": "http://www.siri.org.uk/siri";
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance";
        "@_xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd";
    } & T;
}

/**
 * Returns a SIRI-VM termination time value defined as 10 years after the given time.
 * @param time The response time to offset from.
 * @returns The termination.
 */
export const getSiriVmTerminationTimeOffset = (time: Dayjs) => time.add(10, "years").toISOString();

/**
 * Checks if a given subscription is healthy by looking at whether any of heartbeatLastReceivedDateTime,
 * lastResubscriptionTime, serviceStartDatetime, or lastDataReceivedDateTime were in the last 90 seconds.
 *
 * Data producers are meant to send heartbeats at least every 30 seconds but this is not always the case so the extra
 * checks are intended to prevent over re-subscribing
 *
 * @param subscription The subscription object to check
 * @param currentTime The current time in DayJs
 * @returns Whether the subscription is healthy or not
 */
export const checkSubscriptionIsHealthy = (
    currentTime: Dayjs,
    subscription: AvlSubscription | CancellationsSubscription,
    lastDataReceivedDateTime?: string | null,
) => {
    const { heartbeatLastReceivedDateTime, lastResubscriptionTime, serviceStartDatetime } = subscription;

    const heartbeatThreshold = currentTime.subtract(90, "seconds");

    const heartbeatLastReceivedInThreshold =
        heartbeatLastReceivedDateTime && isDateAfter(getDate(heartbeatLastReceivedDateTime), heartbeatThreshold);

    const lastResubscriptionTimeInThreshold =
        lastResubscriptionTime && isDateAfter(getDate(lastResubscriptionTime), heartbeatThreshold);

    const serviceStartDatetimeInThreshold =
        serviceStartDatetime && isDateAfter(getDate(serviceStartDatetime), heartbeatThreshold);

    const lastDataReceivedDateTimeInThreshold =
        lastDataReceivedDateTime && isDateAfter(getDate(lastDataReceivedDateTime), heartbeatThreshold);

    return !!(
        heartbeatLastReceivedInThreshold ||
        lastResubscriptionTimeInThreshold ||
        lastDataReceivedDateTimeInThreshold ||
        serviceStartDatetimeInThreshold
    );
};

export const formatSiriVmDatetimes = (datetime: Dayjs, includeMilliseconds: boolean) =>
    datetime.format(includeMilliseconds ? "YYYY-MM-DDTHH:mm:ss.SSSZ" : "YYYY-MM-DDTHH:mm:ssZ");
