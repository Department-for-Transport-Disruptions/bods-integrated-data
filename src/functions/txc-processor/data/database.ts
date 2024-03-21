import { logger } from "@baselime/lambda-logger";
import {
    Agency,
    Database,
    LocationType,
    NewCalendar,
    NewCalendarDate,
    NewRoute,
    NewShape,
    NewStop,
} from "@bods-integrated-data/shared/database";
import { Operator, Service, TxcRoute, TxcRouteSection, TxcStop } from "@bods-integrated-data/shared/schema";
import { chunkArray, getRouteTypeFromServiceMode, notEmpty } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { hasher } from "node-object-hash";
import { randomUUID } from "crypto";
import { VehicleJourneyMapping } from "../types";

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

export const insertCalendar = async (
    dbClient: Kysely<Database>,
    calendarData: {
        calendar: NewCalendar;
        calendarDates: NewCalendarDate[];
    },
) => {
    const calendarHash = hasher().hash(calendarData);

    const insertedCalendar = await dbClient
        .insertInto("calendar_new")
        .values({ ...calendarData.calendar, calendar_hash: calendarHash })
        .onConflict((oc) => oc.column("calendar_hash").doUpdateSet({ ...calendarData.calendar }))
        .returningAll()
        .executeTakeFirst();

    if (!insertedCalendar?.id) {
        throw new Error("Calendar failed to insert");
    }

    if (!calendarData.calendarDates) {
        return insertedCalendar;
    }

    await dbClient
        .insertInto("calendar_date_new")
        .values(
            calendarData.calendarDates.map((date) => ({
                date: date.date,
                exception_type: date.exception_type,
                service_id: insertedCalendar.id,
            })),
        )
        .onConflict((oc) => oc.doNothing())
        .execute();

    return insertedCalendar;
};

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

export const insertShapes = async (
    dbClient: Kysely<Database>,
    services: Service[],
    routes: TxcRoute[],
    routeSections: TxcRouteSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const updatedVehicleJourneyMappings = [...vehicleJourneyMappings];

    const routeRefShapeIdMapping: Record<string, string> = {};

    const shapes = vehicleJourneyMappings.flatMap<NewShape>((vehicleJourneyMapping, index) => {
        const journey = vehicleJourneyMapping.vehicleJourney;

        const journeyPattern = services
            .flatMap((s) => s.StandardService.JourneyPattern)
            .find((journeyPattern) => journeyPattern["@_id"] === journey.JourneyPatternRef);

        if (!journeyPattern) {
            logger.warn(`Unable to find journey pattern with journey pattern ref: ${journey.JourneyPatternRef}`);
            return [];
        }

        const txcRoute = routes.find((r) => r["@_id"] === journeyPattern.RouteRef);

        if (!txcRoute) {
            logger.warn(`Unable to find route with route ref: ${journeyPattern.RouteRef}`);
            return [];
        }

        const shapeId = routeRefShapeIdMapping[txcRoute["@_id"]] ?? randomUUID();

        routeRefShapeIdMapping[txcRoute["@_id"]] = shapeId;

        updatedVehicleJourneyMappings[index].shapeId = shapeId;

        let currentPtSequence = 0;

        return txcRoute.RouteSectionRef.flatMap<NewShape>((routeSectionRef) => {
            const routeSection = routeSections.find((rs) => rs["@_id"] === routeSectionRef);

            if (!routeSection) {
                logger.warn(`Unable to find route section with route section ref: ${routeSectionRef}`);
                return [];
            }

            return routeSection.RouteLink.flatMap<NewShape>((routeLink) => {
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
                            shape_dist_traveled: 0,
                        };
                    });
                });
            });
        });
    });

    if (shapes.length > 0) {
        const insertChunks = chunkArray(shapes, 3000);
        await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("shape_new").values(chunk).execute()));
    }

    return updatedVehicleJourneyMappings;
};

export const insertStops = async (dbClient: Kysely<Database>, stops: TxcStop[]) => {
    const platformCodes = ["BCS", "PLT", "FBT"];
    const atcoCodes = stops.map((stop) => stop.StopPointRef);

    const naptanStops = await dbClient
        .selectFrom("naptan_stop_new")
        .selectAll()
        .where("atco_code", "in", atcoCodes)
        .execute();

    const stopsToInsert = stops.map((stop): NewStop => {
        const naptanStop = naptanStops.find((s) => s.atco_code === stop.StopPointRef);

        return {
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
    });

    await dbClient
        .insertInto("stop_new")
        .values(stopsToInsert)
        .onConflict((oc) => oc.column("id").doNothing())
        .returningAll()
        .executeTakeFirst();
};
