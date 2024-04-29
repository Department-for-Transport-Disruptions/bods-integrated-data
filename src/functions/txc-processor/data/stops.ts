import { Database, NewStop, LocationType, NaptanStop } from "@bods-integrated-data/shared/database";
import { TxcAnnotatedStopPointRef, TxcStopPoint } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { getNaptanStop, getNaptanStops, insertStops } from "./database";

const platformCodes = ["BCS", "PLT", "FBT"];

export const mapStop = (
    id: string,
    name: string,
    latitude?: number,
    longitude?: number,
    naptanStop?: NaptanStop,
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
    };

    if (naptanStop) {
        stop.stop_code = naptanStop.naptan_code;

        if (naptanStop.common_name) {
            stop.stop_name = naptanStop.common_name;
        }

        if (naptanStop.latitude) {
            stop.stop_lat = parseFloat(naptanStop.latitude);
        }

        if (naptanStop.longitude) {
            stop.stop_lon = parseFloat(naptanStop.longitude);
        }

        if (naptanStop.stop_type === "RSE") {
            stop.location_type = LocationType.RealStationEntrance;
        }

        if (naptanStop.stop_type && platformCodes.includes(naptanStop.stop_type)) {
            stop.platform_code = naptanStop.stop_type;
        }
    }

    return stop;
};

export const insertStopsByStopPoints = async (dbClient: Kysely<Database>, stops: TxcStopPoint[]) => {
    const stopsToInsert = await Promise.all(
        stops.map(async (stop): Promise<NewStop> => {
            const latitude = stop.Place.Location?.Latitude;
            const longitude = stop.Place.Location?.Longitude;
            const naptanStop = await getNaptanStop(dbClient, stop.AtcoCode);

            return mapStop(stop.AtcoCode, stop.Descriptor.CommonName, latitude, longitude, naptanStop);
        }),
    );

    return insertStops(dbClient, stopsToInsert);
};

export const insertStopsByAnnotatedStopPointRefs = async (
    dbClient: Kysely<Database>,
    stops: TxcAnnotatedStopPointRef[],
) => {
    const atcoCodes = stops.map((stop) => stop.StopPointRef);
    const naptanStops = await getNaptanStops(dbClient, atcoCodes);

    const stopsToInsert = stops.map((stop): NewStop => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.StopPointRef);
        const latitude = stop.Location?.Translation ? stop.Location.Translation.Latitude : stop.Location?.Latitude;
        const longitude = stop.Location?.Translation ? stop.Location?.Translation.Longitude : stop.Location?.Longitude;

        return mapStop(stop.StopPointRef, stop.CommonName, latitude, longitude, naptanStop);
    });

    return insertStops(dbClient, stopsToInsert);
};
