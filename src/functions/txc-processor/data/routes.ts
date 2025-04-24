import { Agency, KyselyDb, NewRoute, Route, RouteType } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { getRouteTypeFromServiceMode, notEmpty } from "@bods-integrated-data/shared/utils";
import { DuplicateRouteError } from "../errors";
import { getTndsRoute, insertRoutes } from "./database";
import { logger } from "@bods-integrated-data/shared/logger";

const getLineId = (isTnds: boolean, lineId: string, serviceCode?: string) =>
    isTnds ? `${serviceCode}_${lineId}` : lineId;

export const processRoutes = async (
    dbClient: KyselyDb,
    service: Service,
    agency: Agency,
    isTnds: boolean,
): Promise<{ routes?: Route[]; isDuplicateRoute?: boolean }> => {
    let routeType = getRouteTypeFromServiceMode(service.Mode);

    try {
        const routes = await Promise.all(
            service.Lines.Line.map(async (line): Promise<NewRoute> => {
                const nocLineName = agency.noc + line.LineName;

                if (isTnds) {
                    const existingRoute = await getTndsRoute(dbClient, nocLineName);

                    if (existingRoute?.data_source === "bods") {
                        throw new DuplicateRouteError();
                    }
                }

                const lineId = getLineId(isTnds, line["@_id"], service.ServiceCode);

                // The London Cable Car is a unique route that does not have a corresponding mode in TXC,
                // thus its route type is set via its line name instead of mode mapping.
                if (line.LineName === "London Cable Car") {
                    routeType = RouteType.CableCar;
                }

                return {
                    agency_id: agency.id,
                    route_short_name: line.LineName,
                    route_long_name: "",
                    route_type: routeType,
                    line_id: lineId,
                    data_source: isTnds ? "tnds" : "bods",
                    noc_line_name: nocLineName,
                };
            }),
        );

        const sortedRoutes = routes.sort((a, b) => a.line_id.localeCompare(b.line_id));
        logger.info("Inserting into routes DB");

        const routeData = await insertRoutes(dbClient, sortedRoutes);
        logger.info("Successfully inserted into routes DB");

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
