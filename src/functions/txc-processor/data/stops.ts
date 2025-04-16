import { KyselyDb, LocationType, NaptanStop, NaptanStopArea, NewStop } from "@bods-integrated-data/shared/database";
import { StopPointLocation, TxcAnnotatedStopPointRef, TxcStopPoint } from "@bods-integrated-data/shared/schema";
import OsPoint from "ospoint";
import { getNaptanStopAreas, getNaptanStops, insertStops } from "./database";

const naptanPlatformStopTypeCodes = ["BCS", "FBT", "PLT", "RPL"];
const naptanStationStopTypeCodes = ["BCE", "FTD", "RSE"];

export type NaptanStopWithRegionCode = NaptanStop & { region_code: string | null };

export const mapStop = (
    naptanStopAreaMap: Record<string, NaptanStopArea>,
    id: string,
    name: string,
    latitude?: number,
    longitude?: number,
    naptanStop?: NaptanStopWithRegionCode,
): NewStop[] => {
    const stop: NewStop = {
        id: id.toUpperCase(),
        wheelchair_boarding: 0,
        parent_station: null,
        stop_name: name.trim(),
        stop_lat: latitude,
        stop_lon: longitude,
        location_type: LocationType.StopOrPlatform,
        platform_code: null,
        region_code: null,
    };

    let stopAreaStop: NewStop | undefined = undefined;

    if (naptanStop) {
        stop.stop_code = naptanStop.naptan_code;

        if (naptanStop.common_name) {
            stop.stop_name = naptanStop.common_name;
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
            stop.platform_code = naptanStop.stop_type;

            const stopArea = naptanStopAreaMap[naptanStop.atco_code];

            if (stopArea) {
                stop.parent_station = stopArea.stop_area_code;
                stopAreaStop = createStopAreaStop(stop, stopArea, LocationType.Station);
            }
        }

        if (naptanStop.stop_type && naptanStationStopTypeCodes.includes(naptanStop.stop_type)) {
            const stopArea = naptanStopAreaMap[naptanStop.atco_code];

            if (stopArea) {
                stop.parent_station = stopArea.stop_area_code;
                stopAreaStop = createStopAreaStop(stop, stopArea, LocationType.EntranceOrExit);
            }
        }
    }

    const stops: NewStop[] = [stop];

    if (stopAreaStop) {
        stops.push(stopAreaStop);
    }

    return stops;
};

export const createStopAreaStop = (stop: NewStop, stopArea: NaptanStopArea, locationType: LocationType): NewStop => ({
    ...stop,
    id: stopArea.stop_area_code,
    stop_name: stopArea.name,
    parent_station: null,
    location_type: locationType,
    stop_lat: stopArea.latitude ? Number.parseFloat(stopArea.latitude) : stop.stop_lat,
    stop_lon: stopArea.longitude ? Number.parseFloat(stopArea.longitude) : stop.stop_lon,
});

export const getCoordinates = (location?: StopPointLocation) => {
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (location?.Translation?.Longitude) {
        longitude = location.Translation.Longitude;
    } else if (location?.Longitude) {
        longitude = location.Longitude;
    }

    if (location?.Translation?.Latitude) {
        latitude = location.Translation.Latitude;
    } else if (location?.Latitude) {
        latitude = location.Latitude;
    }

    if (!longitude || !latitude) {
        const easting = location?.Translation?.Easting || location?.Easting;
        const northing = location?.Translation?.Northing || location?.Northing;

        if (easting && northing) {
            const osPoint = new OsPoint(northing, easting);
            const coords = osPoint.toWGS84();

            latitude = coords?.latitude;
            longitude = coords?.longitude;
        }
    }

    if (!latitude || !longitude) {
        return {
            latitude: undefined,
            longitude: undefined,
        };
    }

    return {
        latitude,
        longitude,
    };
};

export const processStopPoints = async (dbClient: KyselyDb, stops: TxcStopPoint[], useStopLocality: boolean) => {
    const atcoCodes = stops.map((stop) => stop.AtcoCode);
    const naptanStops = await getNaptanStops(dbClient, atcoCodes, useStopLocality);
    const naptanStopAreas = await getNaptanStopAreas(dbClient, atcoCodes);
    const naptanStopAreaMap: Record<string, NaptanStopArea> = {};

    for (const naptanStopArea of naptanStopAreas) {
        naptanStopAreaMap[naptanStopArea.stop_area_code] = naptanStopArea;
    }

    const stopsToInsert: NewStop[] = stops.flatMap((stop) => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.AtcoCode);
        const { latitude, longitude } = getCoordinates(stop.Place.Location);

        return mapStop(naptanStopAreaMap, stop.AtcoCode, stop.Descriptor.CommonName, latitude, longitude, naptanStop);
    });

    if (stopsToInsert.some((s) => !s.stop_lat || !s.stop_lon)) {
        return false;
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
) => {
    const atcoCodes = stops.map((stop) => stop.StopPointRef);
    const naptanStops = await getNaptanStops(dbClient, atcoCodes, useStopLocality);
    const naptanStopAreas = await getNaptanStopAreas(dbClient, atcoCodes);
    const naptanStopAreaMap: Record<string, NaptanStopArea> = {};

    for (const naptanStopArea of naptanStopAreas) {
        naptanStopAreaMap[naptanStopArea.stop_area_code] = naptanStopArea;
    }

    const stopsToInsert: NewStop[] = stops.flatMap((stop) => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.StopPointRef);
        const { latitude, longitude } = getCoordinates(stop.Location);

        return mapStop(naptanStopAreaMap, stop.StopPointRef, stop.CommonName, latitude, longitude, naptanStop);
    });

    if (stopsToInsert.some((s) => !s.stop_lat || !s.stop_lon)) {
        return false;
    }

    if (stopsToInsert.length > 0) {
        await insertStops(dbClient, stopsToInsert);
    }

    return stopsToInsert;
};
