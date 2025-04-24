import { randomUUID } from "node:crypto";
import { KyselyDb, NewShape } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import { TxcRoute, TxcRouteLink, TxcRouteSection } from "@bods-integrated-data/shared/schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { VehicleJourneyMapping, VehicleJourneyMappingWithCalendar } from "../types";
import { insertShapes } from "./database";

export const getRouteRefs = (routes: TxcRoute[], vehicleJourneyMappings: VehicleJourneyMapping[]) => {
    const journeyPatternToRouteRefMapping: Record<string, string> = {};

    const routeRefs = vehicleJourneyMappings
        .map((vehicleJourneyMapping) => {
            const { vehicleJourney, journeyPattern } = vehicleJourneyMapping;

            if (!journeyPattern) {
                logger.warn(
                    `Unable to find journey pattern for vehicle journey with line ref: ${vehicleJourney.LineRef}`,
                );
                return null;
            }

            const txcRoute = routes.find((r) => r["@_id"] === journeyPattern.RouteRef);

            if (!txcRoute) {
                logger.warn(`Unable to find route with route ref: ${journeyPattern.RouteRef}`);
                return null;
            }

            journeyPatternToRouteRefMapping[journeyPattern["@_id"]] = txcRoute["@_id"];

            return txcRoute["@_id"];
        })
        .filter(notEmpty);

    const uniqueRouteRefs = [...new Set(routeRefs)];

    return {
        routeRefs: uniqueRouteRefs,
        journeyPatternToRouteRefMapping,
    };
};

export const getRouteLinks = (
    routeRef: string,
    routes: TxcRoute[],
    routeSections: TxcRouteSection[],
): TxcRouteLink[] => {
    const route = routes.find((route) => route["@_id"] === routeRef);

    const routeSectionsForRoute =
        route?.RouteSectionRef.map((ref) => routeSections.find((rs) => rs["@_id"] === ref)).filter(notEmpty) ?? [];

    if (!routeSectionsForRoute.length) {
        logger.warn(`Unable to find route sections for route: ${routeRef}`);
        return [];
    }

    return routeSectionsForRoute.flatMap((section) => section.RouteLink);
};

export const mapRouteLinksToShapes = (routeLinks: TxcRouteLink[]) => {
    const shapeId = randomUUID();
    let currentPtSequence = 0;

    const shapes = routeLinks.flatMap<NewShape>((routeLink) => {
        if (!routeLink.Track) {
            return [];
        }

        return routeLink.Track.flatMap<NewShape>((track) => {
            // Shape data will only be mapped if both latitude and longitude are defined in either translation data or location data
            return track.Mapping.Location.flatMap<NewShape>((location) => {
                const latitude = location.Translation ? location.Translation.Latitude : location.Latitude;
                const longitude = location.Translation ? location.Translation.Longitude : location.Longitude;

                if (latitude === undefined || longitude === undefined) {
                    return [];
                }

                return {
                    shape_id: shapeId,
                    shape_pt_lat: latitude,
                    shape_pt_lon: longitude,
                    shape_pt_sequence: currentPtSequence++,
                    shape_dist_traveled: null,
                };
            });
        });
    });

    return {
        shapeId: shapes.length > 0 ? shapeId : null,
        shapes,
    };
};

export const processShapes = async (
    dbClient: KyselyDb,
    routes: TxcRoute[],
    routeSections: TxcRouteSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
): Promise<VehicleJourneyMappingWithCalendar[]> => {
    const { routeRefs, journeyPatternToRouteRefMapping } = getRouteRefs(routes, vehicleJourneyMappings);

    const updatedVehicleJourneyMappings = structuredClone(
        vehicleJourneyMappings,
    ) as VehicleJourneyMappingWithCalendar[];

    const shapes = routeRefs.flatMap<NewShape>((routeRef) => {
        const routeLinks = getRouteLinks(routeRef, routes, routeSections);
        const { shapeId, shapes } = mapRouteLinksToShapes(routeLinks);

        for (const mapping of updatedVehicleJourneyMappings) {
            const journeyPatternRef = mapping.journeyPattern?.["@_id"];

            if (journeyPatternRef && journeyPatternToRouteRefMapping[journeyPatternRef] === routeRef) {
                mapping.shapeId = shapeId;
            }
        }

        return shapes;
    });

    if (shapes.length > 0) {
        logger.info("Inserting into shapes DB");

        await insertShapes(dbClient, shapes);
        logger.info("Successfully inserted into shapes DB");
    }

    return updatedVehicleJourneyMappings;
};
