import { KyselyDb, LocationType, NaptanStop, NewStop } from "@bods-integrated-data/shared/database";
import { TxcAnnotatedStopPointRef, TxcStopPoint } from "@bods-integrated-data/shared/schema";
import { getNaptanStops, insertStops } from "./database";

const platformCodes = ["BCS", "PLT", "FBT"];

export type NaptanStopWithRegionCode = NaptanStop & { region_code: string | null };

export const mapStop = (
    id: string,
    name: string,
    latitude?: number,
    longitude?: number,
    naptanStop?: NaptanStopWithRegionCode,
): NewStop => {
    const stop: NewStop = {
        id,
        wheelchair_boarding: 0,
        parent_station: null,
        stop_name: name,
        stop_lat: latitude,
        stop_lon: longitude,
        location_type: LocationType.None,
        platform_code: null,
        region_code: null,
    };

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

        if (naptanStop.stop_type === "RSE") {
            stop.location_type = LocationType.RealStationEntrance;
        }

        if (naptanStop.stop_type && platformCodes.includes(naptanStop.stop_type)) {
            stop.platform_code = naptanStop.stop_type;
        }

        if (naptanStop.region_code) {
            stop.region_code = naptanStop.region_code;
        }
    }

    return stop;
};

export const processStopPoints = async (dbClient: KyselyDb, stops: TxcStopPoint[], useStopLocality: boolean) => {
    const atcoCodes = stops.map((stop) => stop.AtcoCode);
    const naptanStops = await getNaptanStops(dbClient, atcoCodes, useStopLocality);

    const stopsToInsert = stops.map((stop): NewStop => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.AtcoCode);
        const latitude = stop.Place.Location?.Latitude;
        const longitude = stop.Place.Location?.Longitude;

        return mapStop(stop.AtcoCode, stop.Descriptor.CommonName, latitude, longitude, naptanStop);
    });

    if (stopsToInsert.length > 0) {
        await insertStops(dbClient, stopsToInsert);
    }
};

export const processAnnotatedStopPointRefs = async (
    dbClient: KyselyDb,
    stops: TxcAnnotatedStopPointRef[],
    useStopLocality: boolean,
) => {
    const atcoCodes = stops.map((stop) => stop.StopPointRef);
    const naptanStops = await getNaptanStops(dbClient, atcoCodes, useStopLocality);

    const stopsToInsert = stops.map((stop): NewStop => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.StopPointRef);
        const latitude = stop.Location?.Translation ? stop.Location.Translation.Latitude : stop.Location?.Latitude;
        const longitude = stop.Location?.Translation ? stop.Location?.Translation.Longitude : stop.Location?.Longitude;

        return mapStop(stop.StopPointRef, stop.CommonName, latitude, longitude, naptanStop);
    });

    if (stopsToInsert.length > 0) {
        await insertStops(dbClient, stopsToInsert);
    }
};
