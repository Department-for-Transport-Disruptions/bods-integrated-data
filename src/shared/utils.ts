/* eslint-disable import/no-named-as-default-member */
import dayjs, { Dayjs, ManipulateType } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { RouteType } from "./database";

dayjs.extend(timezone);
dayjs.extend(utc);

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

export const getDate = (input?: string) => (input ? dayjs.tz(input, "Europe/London") : dayjs().tz("Europe/London"));

export const addIntervalToDate = (date: string | Date | Dayjs, interval: number, intervalUnit: ManipulateType) =>
    dayjs.tz(date, "Europe/London").add(interval, intervalUnit);

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
