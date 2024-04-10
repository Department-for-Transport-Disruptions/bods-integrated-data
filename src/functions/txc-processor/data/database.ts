import { logger } from "@baselime/lambda-logger";
import {
    Database,
    NewCalendar,
    NewCalendarDate,
    NewFrequency,
    ServiceType,
    Agency,
    NewRoute,
    NewShape,
    NewStop,
    LocationType,
    NewStopTime,
    Route,
    NewTrip,
    NewAgency,
} from "@bods-integrated-data/shared/database";
import { getDuration } from "@bods-integrated-data/shared/dates";
import {
    Operator,
    TxcRouteSection,
    Service,
    TxcStop,
    TxcRoute,
    TxcJourneyPatternSection,
} from "@bods-integrated-data/shared/schema";
import {
    notEmpty,
    getRouteTypeFromServiceMode,
    chunkArray,
    getWheelchairAccessibilityFromVehicleType,
} from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { hasher } from "node-object-hash";
import { randomUUID } from "crypto";
import { VehicleJourneyMapping } from "../types";
import { mapTimingLinksToStopTimes } from "../utils";

export const insertAgencies = async (dbClient: Kysely<Database>, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const existingAgency = await dbClient
            .selectFrom("agency")
            .selectAll()
            .where("noc", "=", operator.NationalOperatorCode)
            .executeTakeFirst();

        const existingNoc = await dbClient
            .selectFrom("noc_operator_new")
            .selectAll()
            .where("noc", "=", operator.NationalOperatorCode)
            .executeTakeFirst();

        const newAgency: NewAgency = {
            name: existingNoc?.operator_public_name ?? operator.OperatorShortName,
            noc: operator.NationalOperatorCode,
            url: "https://www.traveline.info",
            registered_operator_ref: operator["@_id"],
            phone: "",
        };

        return dbClient
            .insertInto("agency_new")
            .values(existingAgency || newAgency)
            .onConflict((oc) => oc.column("noc").doUpdateSet(existingAgency || newAgency))
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

    if (!calendarData.calendarDates?.length) {
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

export const insertFrequencies = async (
    dbClient: Kysely<Database>,
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const frequencies = vehicleJourneyMappings
        .map<NewFrequency | null>((vehicleJourneyMapping) => {
            const { vehicleJourney } = vehicleJourneyMapping;

            if (!vehicleJourney.Frequency) {
                return null;
            }

            let headwaySecs = 0;
            let exactTimes = ServiceType.ScheduleBased;

            if (vehicleJourney.Frequency.Interval?.ScheduledFrequency) {
                headwaySecs = getDuration(vehicleJourney.Frequency.Interval.ScheduledFrequency).asSeconds();

                if (vehicleJourney.Frequency.EndTime) {
                    exactTimes = ServiceType.FrequencyBased;
                }
            }

            return {
                trip_id: vehicleJourneyMapping.tripId,
                start_time: vehicleJourney.DepartureTime,
                end_time: vehicleJourney.Frequency.EndTime || "",
                headway_secs: headwaySecs,
                exact_times: exactTimes,
            };
        })
        .filter(notEmpty);

    if (!frequencies.length) {
        return;
    }

    await dbClient.insertInto("frequency_new").values(frequencies).execute();
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
    let updatedVehicleJourneyMappings = [...vehicleJourneyMappings];

    const journeyPatternToRouteRefMapping: Record<string, string> = {};

    const routeRefs = vehicleJourneyMappings
        .map((vehicleJourneyMapping) => {
            const journey = vehicleJourneyMapping.vehicleJourney;

            const journeyPattern = services
                .flatMap((s) => s.StandardService.JourneyPattern)
                .find((journeyPattern) => journeyPattern["@_id"] === journey.JourneyPatternRef);

            if (!journeyPattern) {
                logger.warn(`Unable to find journey pattern with journey pattern ref: ${journey.JourneyPatternRef}`);
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

    const shapes = uniqueRouteRefs.flatMap<NewShape>((routeRef) => {
        const route = routes.find((route) => route["@_id"] === routeRef);

        const routeSectionsForRoute = routeSections.filter((section) =>
            route?.RouteSectionRef.includes(section["@_id"]),
        );

        if (!routeSectionsForRoute.length) {
            logger.warn(`Unable to find route sections for route: ${routeRef}`);
            return [];
        }

        const routeLinks = routeSectionsForRoute.flatMap((section) => section.RouteLink);

        const shapeId = randomUUID();
        let currentPtSequence = 0;

        updatedVehicleJourneyMappings = updatedVehicleJourneyMappings.map((mapping) => {
            if (journeyPatternToRouteRefMapping[mapping.vehicleJourney.JourneyPatternRef] === routeRef) {
                return {
                    ...mapping,
                    shapeId,
                };
            }

            return mapping;
        });

        return routeLinks.flatMap<NewShape>((routeLink) => {
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
        const latitude = stop.Location?.Translation ? stop.Location.Translation.Latitude : stop.Location?.Latitude;
        const longitude = stop.Location?.Translation ? stop.Location?.Translation.Longitude : stop.Location?.Longitude;

        return {
            id: stop.StopPointRef,
            wheelchair_boarding: 0,
            parent_station: null,

            ...(naptanStop
                ? {
                      stop_code: naptanStop.naptan_code,
                      stop_name: naptanStop.common_name || stop.CommonName,
                      stop_lat: naptanStop.latitude ? parseFloat(naptanStop.latitude) : latitude,
                      stop_lon: naptanStop.longitude ? parseFloat(naptanStop.longitude) : longitude,
                      location_type:
                          naptanStop.stop_type === "RSE" ? LocationType.RealStationEntrance : LocationType.None,
                      platform_code:
                          naptanStop.stop_type && platformCodes.includes(naptanStop.stop_type)
                              ? naptanStop.stop_type
                              : null,
                  }
                : {
                      stop_name: stop.CommonName,
                      stop_lat: stop.Location?.Latitude,
                      stop_lon: stop.Location?.Longitude,
                      location_type: LocationType.None,
                      platform_code: null,
                  }),
        };
    });

    await dbClient
        .insertInto("stop_new")
        .values(stopsToInsert)
        .onConflict((oc) => oc.column("id").doNothing())
        .returningAll()
        .execute();
};

export const insertStopTimes = async (
    dbClient: Kysely<Database>,
    services: Service[],
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const stopTimes = vehicleJourneyMappings.flatMap<NewStopTime>((vehicleJourneyMapping) => {
        const { tripId, vehicleJourney } = vehicleJourneyMapping;

        const journeyPattern = services
            .flatMap((s) => s.StandardService.JourneyPattern)
            .find((journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef);

        if (!journeyPattern) {
            logger.warn(`Unable to find journey pattern with journey pattern ref: ${vehicleJourney.JourneyPatternRef}`);
            return [];
        }

        const journeyPatternTimingLinks = journeyPattern.JourneyPatternSectionRefs.flatMap((ref) => {
            const journeyPatternSection = txcJourneyPatternSections.find((section) => section["@_id"] === ref);

            if (!journeyPatternSection) {
                logger.warn(`Unable to find journey pattern section with journey pattern section ref: ${ref}`);
                return [];
            }

            return journeyPatternSection.JourneyPatternTimingLink;
        });

        return mapTimingLinksToStopTimes(tripId, vehicleJourney, journeyPatternTimingLinks);
    });

    if (stopTimes.length > 0) {
        const insertChunks = chunkArray(stopTimes, 3000);
        await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("stop_time_new").values(chunk).execute()));
    }
};

export const insertTrips = async (
    dbClient: Kysely<Database>,
    txcServices: Service[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
    routes: Route[],
    filePath: string,
) => {
    const updatedVehicleJourneyMappings = [...vehicleJourneyMappings];

    const trips = vehicleJourneyMappings
        .map<NewTrip | null>((vehicleJourneyMapping, index) => {
            const { vehicleJourney } = vehicleJourneyMapping;
            const route = routes.find((route) => route.line_id === vehicleJourney.LineRef);

            if (!route) {
                logger.warn(`Unable to find route with line ref: ${vehicleJourney.LineRef}`);
                return null;
            }

            const journeyPattern = txcServices
                .flatMap((s) => s.StandardService.JourneyPattern)
                .find((journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef);

            if (!journeyPattern) {
                logger.warn(
                    `Unable to find journey pattern with journey pattern ref: ${vehicleJourney.JourneyPatternRef}`,
                );
                return null;
            }

            const tripId = randomUUID();

            updatedVehicleJourneyMappings[index].tripId = tripId;

            return {
                id: tripId,
                route_id: vehicleJourneyMapping.routeId,
                service_id: vehicleJourneyMapping.serviceId,
                block_id: vehicleJourney.Operational?.Block?.BlockNumber || "",
                shape_id: vehicleJourneyMapping.shapeId,
                trip_headsign: vehicleJourney.DestinationDisplay || journeyPattern?.DestinationDisplay || "",
                wheelchair_accessible: getWheelchairAccessibilityFromVehicleType(
                    vehicleJourney.Operational?.VehicleType,
                ),
                vehicle_journey_code: vehicleJourney.VehicleJourneyCode,
                file_path: filePath,
            };
        })
        .filter(notEmpty);

    await dbClient.insertInto("trip_new").values(trips).execute();

    return updatedVehicleJourneyMappings;
};
