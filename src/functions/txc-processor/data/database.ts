import { logger } from "@baselime/lambda-logger";
import {
    Agency,
    Database,
    LocationType,
    NewCalendar,
    NewRoute,
    getRouteTypeFromServiceMode,
    notEmpty,
} from "@bods-integrated-data/shared";
import { Operator, Service, TxcStop } from "@bods-integrated-data/shared/schema";
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
                    registered_operator_ref: operator["@_id"],
                },
            )
            .onConflict((oc) => oc.column("noc").doUpdateSet({ name: operator.OperatorShortName }))
            .returningAll()
            .executeTakeFirst();
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};

export const insertCalendar = async (dbClient: Kysely<Database>, calendar: NewCalendar) =>
    dbClient.insertInto("calendar_new").values(calendar).returningAll().executeTakeFirst();

export const insertRoutes = async (dbClient: Kysely<Database>, service: Service, agencyData: Agency[]) => {
    const agency = agencyData.find((agency) => agency.registered_operator_ref === service.RegisteredOperatorRef);

    if (!agency) {
        logger.warn(`Unable to find agency with registered operator ref: ${service.RegisteredOperatorRef}`);
        return null;
    }

    const routeType = getRouteTypeFromServiceMode(service.Mode);

    const routePromises = service.Lines.Line.map(async (line) => {
        const existingRoute = await dbClient
            .selectFrom("route")
            .selectAll()
            .where("line_id", "=", line["@_id"])
            .executeTakeFirst();

        const newRoute: NewRoute = {
            agency_id: agency.id,
            route_short_name: line.LineName,
            route_long_name: "",
            route_type: routeType,
            line_id: line["@_id"],
        };

        return dbClient
            .insertInto("route_new")
            .values(existingRoute || newRoute)
            .onConflict((oc) =>
                oc.column("line_id").doUpdateSet({ route_short_name: line.LineName, route_type: routeType }),
            )
            .returningAll()
            .executeTakeFirst();
    });

    const routeData = await Promise.all(routePromises);

    return routeData.filter(notEmpty);
};

export const insertStops = async (dbClient: Kysely<Database>, stops: TxcStop[]) => {
    const platformCodes = ["BCS", "PLT", "FBT"];
    const atcoCodes = stops.map((stop) => stop.StopPointRef);

    const naptanStops = await dbClient
        .selectFrom("naptan_stop_new")
        .selectAll()
        .where("atco_code", "in", atcoCodes)
        .execute();

    const stopsPromises = stops.map(async (stop) => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.StopPointRef);

        const newStop = {
            id: stop.StopPointRef,
            wheelchair_boarding: 0,
            parent_station: "",

            ...(naptanStop
                ? {
                      stop_code: naptanStop.naptan_code,
                      stop_name: naptanStop.common_name || stop.CommonName,
                      stop_lat: naptanStop.latitude ? parseFloat(naptanStop.latitude) : stop.Location?.Latitude,
                      stop_lon: naptanStop.longitude ? parseFloat(naptanStop.longitude) : stop.Location?.Longitude,
                      location_type:
                          naptanStop.stop_type === "RSE" ? LocationType.RealStationEntrance : LocationType.None,
                      platform_code:
                          naptanStop.stop_type && platformCodes.includes(naptanStop.stop_type)
                              ? naptanStop.stop_type
                              : "",
                  }
                : {
                      stop_name: stop.CommonName,
                      stop_lat: stop.Location?.Latitude,
                      stop_lon: stop.Location?.Longitude,
                      location_type: LocationType.None,
                      platform_code: "",
                  }),
        };

        return dbClient
            .insertInto("stop_new")
            .values(newStop)
            .onConflict((oc) => oc.column("id").doUpdateSet(newStop))
            .returningAll()
            .executeTakeFirst();
    });

    const stopData = await Promise.all(stopsPromises);
    return stopData.filter(notEmpty);
};
