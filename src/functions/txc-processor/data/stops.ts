import {
    KyselyDb,
    LocationType,
    NaptanStop,
    NaptanStopArea,
    NewStop,
    WheelchairAccessibility,
} from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import { StopPointLocation, TxcAnnotatedStopPointRef, TxcStopPoint } from "@bods-integrated-data/shared/schema";
import OsPoint from "ospoint";
import { areCoordinatesValid } from "../utils";
import { getNaptanStopAreas, getNaptanStops, insertStops } from "./database";

const naptanPlatformStopTypeCodes = ["BCS", "FBT", "PLT", "RPL"];
const naptanStationEntranceStopTypeCodes = ["BCE", "FTD", "RSE"];
const platformTypes = ["stand", "stance", "platform", "bay", "stop"];
const indicatorIgnoredWords = [
    "adj",
    "at",
    "quay",
    "pier",
    "o/s",
    "opp",
    "arrivals",
    "departures",
    "inside",
    "outside",
    "near",
    "nr",
    "opposite",
    "by",
    "in",
    "landing",
    "berth",
    "bay",
    "jetty",
    "platform",
    "stand",
    "stance",
    "stances",
    "after",
    "dead",
    "entrance",
    "for",
    "gen",
    "location",
    "net",
    "bound",
    "shudehill",
    " ",
    "-",
];

export type NaptanStopWithRegionCode = NaptanStop & { region_code: string | null };

export const sanitiseIndicator = (indicator: string | null): string | null => {
    if (!indicator) {
        return null;
    }

    let indicatorToReturn = indicator.trim();

    if (platformTypes.some((type) => indicatorToReturn.toLowerCase().startsWith(type))) {
        indicatorToReturn = indicatorToReturn.split(" ").slice(1).join(" ").trim();
    }

    if (indicatorIgnoredWords.some((word) => indicatorToReturn.toLowerCase().includes(word))) {
        return null;
    }

    return indicatorToReturn;
};

export const getLocationType = (naptanStop?: NaptanStop): LocationType => {
    if (
        naptanStop?.stop_type &&
        naptanStationEntranceStopTypeCodes.includes(naptanStop.stop_type) &&
        naptanStop.stop_area_code
    ) {
        return LocationType.EntranceOrExit;
    }

    return LocationType.StopOrPlatform;
};

export const mapStop = (
    naptanStopAreaMap: Record<string, NaptanStopArea>,
    id: string,
    name: string,
    latitude: number,
    longitude: number,
    naptanStop?: NaptanStopWithRegionCode,
): NewStop[] => {
    const stop: NewStop = {
        id,
        wheelchair_boarding: WheelchairAccessibility.NoAccessibilityInformation,
        parent_station: null,
        stop_name: name.trim(),
        stop_lat: latitude,
        stop_lon: longitude,
        location_type: getLocationType(naptanStop),
        platform_code: null,
        region_code: null,
    };

    let stopAreaStop: NewStop | null = null;

    if (naptanStop) {
        stop.stop_code = naptanStop.naptan_code;

        if (naptanStop.common_name) {
            stop.stop_name = naptanStop.common_name.trim();
        }

        if (naptanStop.latitude) {
            stop.stop_lat = Number.parseFloat(naptanStop.latitude);
        }

        if (naptanStop.longitude) {
            stop.stop_lon = Number.parseFloat(naptanStop.longitude);
        }

        if (naptanStop.region_code) {
            stop.region_code = naptanStop.region_code;
        }

        if (naptanStop.stop_type && naptanPlatformStopTypeCodes.includes(naptanStop.stop_type)) {
            stop.platform_code = sanitiseIndicator(naptanStop.indicator);
        }

        if (
            naptanStop.stop_type &&
            naptanStop.stop_area_code &&
            (naptanPlatformStopTypeCodes.includes(naptanStop.stop_type) ||
                naptanStationEntranceStopTypeCodes.includes(naptanStop.stop_type))
        ) {
            const stopArea = naptanStopAreaMap[naptanStop.stop_area_code];

            if (stopArea) {
                stopAreaStop = createStopAreaStop(stopArea, LocationType.Station, naptanStop.region_code);

                if (stopAreaStop) {
                    stop.parent_station = stopArea.stop_area_code;
                }
            }
        }
    }

    if (stop.location_type === LocationType.EntranceOrExit && !stopAreaStop) {
        return [];
    }

    const stops: NewStop[] = [stop];

    if (stopAreaStop) {
        stops.push(stopAreaStop);
    }

    return stops;
};

export const createStopAreaStop = (
    stopArea: NaptanStopArea,
    locationType: LocationType,
    regionCode: string | null,
): NewStop | null => {
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (stopArea.longitude) {
        longitude = Number.parseFloat(stopArea.longitude);
    }

    if (stopArea.latitude) {
        latitude = Number.parseFloat(stopArea.latitude);
    }

    if (!areCoordinatesValid([latitude, longitude])) {
        if (stopArea.northing && stopArea.easting) {
            const osPoint = new OsPoint(stopArea.northing, stopArea.easting);
            const coords = osPoint.toWGS84();

            latitude = coords?.latitude;
            longitude = coords?.longitude;
        }
    }

    if (!areCoordinatesValid([latitude, longitude])) {
        return null;
    }

    return {
        id: stopArea.stop_area_code,
        wheelchair_boarding: WheelchairAccessibility.NoAccessibilityInformation,
        parent_station: null,
        stop_name: stopArea.name.trim(),
        location_type: locationType,
        stop_lat: latitude,
        stop_lon: longitude,
        stop_code: null,
        platform_code: null,
        region_code: regionCode,
    };
};

export const getCoordinates = (location?: StopPointLocation, naptanStop?: NaptanStop) => {
    const naptanCoords = [naptanStop?.latitude, naptanStop?.longitude] as const;

    if (areCoordinatesValid(naptanCoords)) {
        return {
            latitude: Number.parseFloat(naptanCoords[0]),
            longitude: Number.parseFloat(naptanCoords[1]),
        };
    }

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (location?.Translation?.Longitude !== undefined) {
        longitude = location.Translation.Longitude;
    } else if (location?.Longitude !== undefined) {
        longitude = location.Longitude;
    }

    if (location?.Translation?.Latitude !== undefined) {
        latitude = location.Translation.Latitude;
    } else if (location?.Latitude !== undefined) {
        latitude = location.Latitude;
    }

    if (!areCoordinatesValid([latitude, longitude])) {
        const easting = location?.Translation?.Easting || location?.Easting;
        const northing = location?.Translation?.Northing || location?.Northing;

        if (easting && northing) {
            const osPoint = new OsPoint(northing, easting);
            const coords = osPoint.toWGS84();

            latitude = coords?.latitude;
            longitude = coords?.longitude;
        }
    }

    const coords = [latitude, longitude] as const;

    if (!areCoordinatesValid(coords)) {
        return {
            latitude: undefined,
            longitude: undefined,
        };
    }

    return {
        latitude: coords[0],
        longitude: coords[1],
    };
};

export const processStopPoints = async (
    dbClient: KyselyDb,
    stops: TxcStopPoint[],
    useStopLocality: boolean,
    stopsInJourneyPatternSections: string[],
) => {
    const atcoCodes = stops.map((stop) => stop.AtcoCode);
    const naptanStops = (await getNaptanStops(dbClient, atcoCodes, useStopLocality)) ?? [];

    const naptanStopAreaCodes = naptanStops.map((s) => s.stop_area_code).filter((code) => code !== null);
    const naptanStopAreaMap: Record<string, NaptanStopArea> = {};

    if (naptanStopAreaCodes.length > 0) {
        const naptanStopAreas = await getNaptanStopAreas(dbClient, naptanStopAreaCodes);

        for (const naptanStopArea of naptanStopAreas) {
            naptanStopAreaMap[naptanStopArea.stop_area_code] = naptanStopArea;
        }
    }

    const stopsWithMissingCoordinates: string[] = [];

    const stopsToInsert: NewStop[] = stops.flatMap((stop) => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.AtcoCode);

        const { latitude, longitude } = getCoordinates(stop.Place.Location, naptanStop);

        const coords = [latitude, longitude] as const;

        if (!areCoordinatesValid(coords)) {
            stopsWithMissingCoordinates.push(stop.AtcoCode);
            return [];
        }

        return mapStop(naptanStopAreaMap, stop.AtcoCode, stop.Descriptor.CommonName, coords[0], coords[1], naptanStop);
    });

    if (stopsWithMissingCoordinates.length > 0) {
        if (stopsWithMissingCoordinates.some((s) => stopsInJourneyPatternSections.includes(s))) {
            logger.warn(`Some stops have missing coordinates: ${stopsWithMissingCoordinates}`);
            return false;
        }
    }

    if (stopsToInsert.length > 0) {
        await insertStops(dbClient, stopsToInsert);
    }

    return stopsToInsert;
};

export const processAnnotatedStopPointRefs = async (
    dbClient: KyselyDb,
    stops: TxcAnnotatedStopPointRef[],
    useStopLocality: boolean,
    stopsInJourneyPatternSections: string[],
) => {
    const atcoCodes = stops.map((stop) => stop.StopPointRef);
    const naptanStops = (await getNaptanStops(dbClient, atcoCodes, useStopLocality)) ?? [];

    const naptanStopAreaCodes = naptanStops.map((s) => s.stop_area_code).filter((code) => code !== null);
    const naptanStopAreaMap: Record<string, NaptanStopArea> = {};

    if (naptanStopAreaCodes.length > 0) {
        const naptanStopAreas = await getNaptanStopAreas(dbClient, naptanStopAreaCodes);

        for (const naptanStopArea of naptanStopAreas) {
            naptanStopAreaMap[naptanStopArea.stop_area_code] = naptanStopArea;
        }
    }

    const stopsWithMissingCoordinates: string[] = [];

    const stopsToInsert: NewStop[] = stops.flatMap((stop) => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.StopPointRef);
        const { latitude, longitude } = getCoordinates(stop.Location, naptanStop);

        const coords = [latitude, longitude] as const;

        if (!areCoordinatesValid(coords)) {
            stopsWithMissingCoordinates.push(stop.StopPointRef);
            return [];
        }

        return mapStop(naptanStopAreaMap, stop.StopPointRef, stop.CommonName, coords[0], coords[1], naptanStop);
    });

    if (stopsWithMissingCoordinates.length > 0) {
        if (stopsWithMissingCoordinates.some((s) => stopsInJourneyPatternSections.includes(s))) {
            logger.warn(`Some stops have missing coordinates: ${stopsWithMissingCoordinates}`);
            return false;
        }
    }

    if (stopsToInsert.length > 0) {
        await insertStops(dbClient, stopsToInsert);
    }

    return stopsToInsert;
};
