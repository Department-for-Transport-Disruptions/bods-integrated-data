import { Database, notEmpty } from "@bods-integrated-data/shared";
import { Operator, Stop } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";

export const insertAgencies = async (dbClient: Kysely<Database>, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const existingAgency = await dbClient
            .selectFrom("agency")
            .selectAll()
            .where("noc", "=", operator.NationalOperatorCode)
            .executeTakeFirst();

        return dbClient
            .insertInto("agency_new")
            .values(
                existingAgency || {
                    name: operator.OperatorShortName,
                    noc: operator.NationalOperatorCode,
                    url: "",
                },
            )
            .onConflict((oc) => oc.column("noc").doUpdateSet({ name: operator.OperatorShortName }))
            .returningAll()
            .executeTakeFirst();
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};

export const insertStops = async (dbClient: Kysely<Database>, stops: Stop[]) => {
    const platformCodes = ["BCS", "PLT", "FBT"];
    const stopsPromises = stops.map(async (stop) => {
        const naptanStop = await dbClient
            .selectFrom("naptan_stop")
            .selectAll()
            .where("atcoCode", "=", stop.StopPointRef)
            .executeTakeFirst();

        const newStop = {
            id: stop.StopPointRef,
            wheelchair_boarding: 0,
            parent_station: "",

            ...(naptanStop
                ? {
                      stop_code: naptanStop.naptanCode,
                      stop_name: naptanStop.commonName || stop.CommonName,
                      stop_lat: naptanStop.latitude ? parseFloat(naptanStop.latitude) : stop.Location?.Latitude,
                      stop_lon: naptanStop.longitude ? parseFloat(naptanStop.longitude) : stop.Location?.Longitude,
                      location_type: naptanStop.stopType === "RSE" ? 2 : 0,
                      platform_code:
                          naptanStop.stopType && platformCodes.includes(naptanStop.stopType) ? naptanStop.stopType : "",
                  }
                : {
                      stop_name: stop.CommonName,
                      stop_lat: stop.Location?.Latitude,
                      stop_lon: stop.Location?.Longitude,
                      location_type: 0,
                      platform_code: "",
                  }),
        };

        return dbClient.insertInto("stop_new").values(newStop).returningAll().executeTakeFirst();
    });

    const stopData = await Promise.all(stopsPromises);
    return stopData.filter(notEmpty);
};
