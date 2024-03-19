/* eslint-disable import/no-named-as-default-member */
import dayjs, { Dayjs, ManipulateType } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { RouteType, WheelchairAccessibility } from "./database";
import { VehicleType } from "./schema";

dayjs.extend(duration);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(customParseFormat);

dayjs.tz.setDefault("Europe/London");

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

export const getDateWithCustomFormat = (date: string, format: string) => dayjs(date, format);
export const getCurrentDate = () => dayjs();
export const getDurationInSeconds = (duration: string) => dayjs.duration(duration).asSeconds();

export const getWheelchairAccessibilityFromVehicleType = (vehicleType?: VehicleType) => {
    if (!vehicleType) {
        return WheelchairAccessibility.NoAccessibilityInformation;
    }

    const hasWheelchairEquipment = !!vehicleType.VehicleEquipment?.WheelchairEquipment;
    const numberOfWheelChairAreas = vehicleType.VehicleEquipment?.WheelchairEquipment?.NumberOfWheelChairAreas || 0;

    if (vehicleType.WheelChairAccessible || (hasWheelchairEquipment && numberOfWheelChairAreas > 0)) {
        return WheelchairAccessibility.Accessible;
    }

    if (vehicleType.WheelChairAccessible === false || (hasWheelchairEquipment && numberOfWheelChairAreas === 0)) {
        return WheelchairAccessibility.NotAccessible;
    }

    return WheelchairAccessibility.NoAccessibilityInformation;
};
