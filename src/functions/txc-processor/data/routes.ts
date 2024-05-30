import { Agency, KyselyDb, NewRoute, Route } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { getRouteTypeFromServiceMode, notEmpty } from "@bods-integrated-data/shared/utils";
import { DuplicateRouteError } from "../errors";
import { getTndsRoute, insertRoute } from "./database";

export const processRoutes = async (
    dbClient: KyselyDb,
    service: Service,
    agency: Agency,
    isTnds: boolean,
): Promise<{ routes?: Route[]; isDuplicateRoute?: boolean }> => {
    const routeType = getRouteTypeFromServiceMode(service.Mode);

    try {
        const routePromises = service.Lines.Line.map(async (line) => {
            const nocLineName = agency.noc + line.LineName;

            if (isTnds) {
                const existingRoute = await getTndsRoute(dbClient, nocLineName);

                if (existingRoute?.data_source === "bods") {
                    throw new DuplicateRouteError();
                }
            }

            const newRoute: NewRoute = {
                agency_id: agency.id,
                route_short_name: line.LineName,
                route_long_name: "",
                route_type: routeType,
                line_id: isTnds ? `${service.ServiceCode}_${line["@_id"]}` : line["@_id"],
                data_source: isTnds ? "tnds" : "bods",
                noc_line_name: nocLineName,
            };

            return insertRoute(dbClient, newRoute);
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
