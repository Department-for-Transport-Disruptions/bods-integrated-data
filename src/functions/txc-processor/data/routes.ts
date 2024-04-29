import { Database, Agency, NewRoute, Route } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { notEmpty, getRouteTypeFromServiceMode } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { getBodsRoute, getTndsRoute, insertRoute } from "./database";
import { DuplicateRouteError } from "../errors";

export const processRoutes = async (
    dbClient: Kysely<Database>,
    service: Service,
    agency: Agency,
    isTnds: boolean,
): Promise<{ routes?: Route[]; isDuplicateRoute?: boolean }> => {
    const routeType = getRouteTypeFromServiceMode(service.Mode);

    try {
        const routePromises = service.Lines.Line.map(async (line) => {
            const nocLineName = agency.noc + line.LineName;

            const existingRoute = isTnds
                ? await getTndsRoute(dbClient, nocLineName)
                : await getBodsRoute(dbClient, line["@_id"]);

            const newRoute: NewRoute = {
                agency_id: agency.id,
                route_short_name: line.LineName,
                route_long_name: "",
                route_type: routeType,
                line_id: line["@_id"],
                data_source: isTnds ? "tnds" : "bods",
                noc_line_name: nocLineName,
            };

            if (isTnds && existingRoute?.data_source === "bods") {
                throw new DuplicateRouteError();
            }

            return insertRoute(dbClient, existingRoute || newRoute);
        });

        const routeData = await Promise.all(routePromises);

        return {
            routes: routeData.filter(notEmpty),
        };
    } catch (error) {
        if (error instanceof DuplicateRouteError) {
            return {
                isDuplicateRoute: true,
            };
        }

        throw error;
    }
};
