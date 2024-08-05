import { ALBEvent, APIGatewayProxyEvent } from "aws-lambda";
import { ZodSchema, z } from "zod";
import { fromZodError } from "zod-validation-error";
import { putMetricData } from "./cloudwatch";
import { RouteType, WheelchairAccessibility } from "./database";
import { recursiveScan } from "./dynamo";
import { logger } from "./logger";
import { VehicleType } from "./schema";
import { avlSubscriptionSchemaTransformed } from "./schema/avl-subscribe.schema";
import { getParameter } from "./ssm";

export const chunkArray = <T>(array: T[], chunkSize: number) => {
    const chunkArray = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunkArray.push(array.slice(i, i + chunkSize));
    }

    return chunkArray;
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

export const getSubscriptionUsernameAndPassword = async (subscriptionId: string) => {
    const [subscriptionUsernameParam, subscriptionPasswordParam] = await Promise.all([
        getParameter(`/subscription/${subscriptionId}/username`, true),
        getParameter(`/subscription/${subscriptionId}/password`, true),
    ]);

    const subscriptionUsername = subscriptionUsernameParam.Parameter?.Value ?? null;
    const subscriptionPassword = subscriptionPasswordParam.Parameter?.Value ?? null;

    return {
        subscriptionUsername,
        subscriptionPassword,
    };
};

export const getMockDataProducerSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions || subscriptions.length === 0) {
        return null;
    }

    const parsedSubscriptions = z.array(avlSubscriptionSchemaTransformed).parse(subscriptions);

    return parsedSubscriptions.filter(
        (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "live",
    );
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
