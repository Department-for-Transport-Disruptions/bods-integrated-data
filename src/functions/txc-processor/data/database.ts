import { logger } from "@baselime/lambda-logger";
import {
    Agency,
    Database,
    LocationType,
    NewFrequency,
    NewRoute,
    NewShape,
    NewStop,
    NewTrip,
    Route,
    ServiceType,
    getDurationInSeconds,
    getRouteTypeFromServiceMode,
    getWheelchairAccessibilityFromVehicleType,
    notEmpty,
} from "@bods-integrated-data/shared";
import { Operator, TxcRouteSection, Service, TxcStop, TxcRoute } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { randomUUID } from "crypto";
import { ServiceExpiredError } from "../errors";
import { VehicleJourneyMapping } from "../types";
import { formatCalendar, getOperatingProfile } from "../utils";

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

export const insertCalendars = async (
    dbClient: Kysely<Database>,
    service: Service,
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const serviceCalendar = service.OperatingProfile
        ? await dbClient
              .insertInto("calendar_new")
              .values(formatCalendar(service.OperatingProfile, service.OperatingPeriod))
              .returningAll()
              .executeTakeFirst()
        : null;

    const updatedVehicleJourneyMappings = [...vehicleJourneyMappings];

    const promises = vehicleJourneyMappings.flatMap(async (vehicleJourneyMapping, index) => {
        const journey = vehicleJourneyMapping.vehicleJourney;

        try {
            let journeyCalendar = serviceCalendar;

            if (journey.OperatingProfile || !serviceCalendar) {
                journeyCalendar = await dbClient
                    .insertInto("calendar_new")
                    .values(getOperatingProfile(service, journey))
                    .returningAll()
                    .executeTakeFirst();
            }

            if (journeyCalendar) {
                updatedVehicleJourneyMappings[index].serviceId = journeyCalendar?.id;
            }

            return journeyCalendar;
        } catch (e) {
            if (e instanceof ServiceExpiredError) {
                logger.warn(`Service expired: ${service.ServiceCode}`);
            }

            return null;
        }
    });

    await Promise.all(promises);

    return updatedVehicleJourneyMappings;
};

export const insertFrequencies = async (
    dbClient: Kysely<Database>,
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const promises = vehicleJourneyMappings.map(async (vehicleJourneyMapping) => {
        const { vehicleJourney } = vehicleJourneyMapping;
        let headwaySecs = 0;
        let exactTimes = ServiceType.ScheduleBased;

        if (vehicleJourney.Frequency?.Interval?.ScheduledFrequency) {
            headwaySecs = getDurationInSeconds(vehicleJourney.Frequency.Interval.ScheduledFrequency);

            if (vehicleJourney.Frequency?.EndTime) {
                exactTimes = ServiceType.FrequencyBased;
            }
        }

        const newFrequency: NewFrequency = {
            trip_id: vehicleJourneyMapping.tripId,
            start_time: vehicleJourney.DepartureTime,
            end_time: vehicleJourney.Frequency?.EndTime || "",
            headway_secs: headwaySecs,
            exact_times: exactTimes,
        };

        return dbClient.insertInto("frequencies_new").values(newFrequency).returningAll().executeTakeFirst();
    });

    const tripData = await Promise.all(promises);

    return tripData.filter(notEmpty);
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

        const shapeId = randomUUID();
        updatedVehicleJourneyMappings[index].shapeId = shapeId;

        let current_pt_sequence = 0;

        return txcRoute.RouteSectionRef.flatMap<NewShape>((routeSectionRef) => {
            const routeSection = routeSections.find((rs) => rs["@_id"] === routeSectionRef);

            if (!routeSection) {
                logger.warn(`Unable to find route section with route section ref: ${routeSectionRef}`);
                return [];
            }

            return routeSection.RouteLink.Track.Mapping.Location.map<NewShape>((location) => ({
                shape_id: shapeId,
                shape_pt_lat: location.Translation.Latitude,
                shape_pt_lon: location.Translation.Longitude,
                shape_pt_sequence: current_pt_sequence++,
                shape_dist_traveled: 0,
            }));
        });
    });

    await dbClient.insertInto("shape_new").values(shapes).returningAll().executeTakeFirst();

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

export const insertTrips = async (
    dbClient: Kysely<Database>,
    txcServices: Service[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
    routes: Route[],
) => {
    const promises = vehicleJourneyMappings.map(async (vehicleJourneyMapping) => {
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
            logger.warn(`Unable to find journey pattern with journey pattern ref: ${vehicleJourney.JourneyPatternRef}`);
            return null;
        }

        const newTrip: NewTrip = {
            route_id: vehicleJourneyMapping.routeId,
            service_id: vehicleJourneyMapping.serviceId,
            block_id: vehicleJourney.Operational?.Block?.BlockNumber || "",
            shape_id: vehicleJourneyMapping.shapeId,
            trip_headsign: vehicleJourney.DestinationDisplay || journeyPattern?.DestinationDisplay || "",
            wheelchair_accessible: getWheelchairAccessibilityFromVehicleType(vehicleJourney.Operational?.VehicleType),
            vehicle_journey_code: vehicleJourney.VehicleJourneyCode,
        };

        return dbClient.insertInto("trip_new").values(newTrip).returningAll().executeTakeFirst();
    });

    const tripData = await Promise.all(promises);

    return tripData.filter(notEmpty);
};
