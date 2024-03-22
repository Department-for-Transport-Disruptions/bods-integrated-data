import { z } from "zod";
import { RouteType, WheelchairAccessibility } from "./database";
import { VehicleType } from "./schema";

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

export const txcSelfClosingProperty = z.literal("");
