import { logger } from "@baselime/lambda-logger";
import { Agency, KyselyDb, NewRoute, Route } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { getRouteTypeFromServiceMode, notEmpty } from "@bods-integrated-data/shared/utils";
import { DuplicateRouteError } from "../errors";
import { getPreviousRouteIdByLineId, getTndsRoute, insertRoutes } from "./database";

const getLineId = (isTnds: boolean, lineId: string, serviceCode?: string) =>
    isTnds ? `${serviceCode}_${lineId}` : lineId;

export const processRoutes = async (
    dbClient: KyselyDb,
    service: Service,
    agency: Agency,
    isTnds: boolean,
): Promise<{ routes?: Route[]; isDuplicateRoute?: boolean }> => {
    const routeType = getRouteTypeFromServiceMode(service.Mode);

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

                const previousRoute = await getPreviousRouteIdByLineId(dbClient, lineId);

                if (previousRoute) {
                    logger.info(`Using route ID from previous import, routeId: ${previousRoute.id}, lineId: ${lineId}`);
                } else {
                    logger.info(`Creating new route ID for line: ${lineId}`);
                }

                return {
                    id: previousRoute?.id,
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

        const routeData = await insertRoutes(dbClient, sortedRoutes);

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
