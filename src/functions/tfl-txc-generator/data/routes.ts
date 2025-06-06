import { TxcRoute, TxcRouteLink, TxcRouteSection } from "@bods-integrated-data/shared/schema";
import { TflIBusData } from "./db";

export const generateRouteSections = (patterns: TflIBusData["patterns"]): { RouteSection: TxcRouteSection[] } => ({
    RouteSection: patterns.map<TxcRouteSection>((pattern, index) => ({
        "@_id": `RS${index + 1}`,
        RouteLink: pattern.stops.flatMap<TxcRouteLink>((stop, stopIndex) => {
            if (stopIndex >= pattern.stops.length - 1) {
                return [];
            }

            return {
                "@_id": `RL${index + 1}-${stopIndex + 1}`,
                From: {
                    StopPointRef: stop.atco_code,
                },
                To: {
                    StopPointRef: pattern.stops[stopIndex + 1].atco_code,
                },
            };
        }),
    })),
});

export const generateRoutes = (patterns: TflIBusData["patterns"]): { Route: TxcRoute[] } => ({
    Route: patterns.map<TxcRoute>((pattern, index) => ({
        "@_id": `R${index + 1}`,
        Description: `To ${
            pattern.stops[pattern.stops.length - 1].short_destination_name ??
            pattern.stops[pattern.stops.length - 1].common_name
        }`,
        RouteSectionRef: [`RS${index + 1}`],
    })),
});
