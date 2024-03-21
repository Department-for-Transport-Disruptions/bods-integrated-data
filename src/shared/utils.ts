import { z } from "zod";
import { RouteType } from "./database";

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

export const getRouteTypeFromServiceMode = (mode: string) => {
    switch (mode) {
        case "bus":
            return RouteType.Bus;
        case "coach":
            return RouteType.Coach;
        case "ferry":
            return RouteType.Ferry;
        case "metro":
            return RouteType.TramOrMetro;
        case "tram":
            return RouteType.TramOrMetro;
        case "underground":
            return RouteType.Underground;
        default:
            return RouteType.Bus;
    }
};

export const txcSelfClosingProperty = z.literal("");
