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
    getDuration,
    chunkArray,
    getRouteTypeFromServiceMode,
    getWheelchairAccessibilityFromVehicleType,
    notEmpty,
    getDateWithCustomFormat,
    NewStopTime,
} from "@bods-integrated-data/shared";
import {
    Operator,
    TxcRouteSection,
    Service,
    TxcStop,
    TxcRoute,
    TxcJourneyPatternSection,
} from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { randomUUID } from "crypto";
import { ServiceExpiredError } from "../errors";
import { VehicleJourneyMapping } from "../types";
import {
    formatCalendar,
    getDropOffTypeFromStopActivity,
    getOperatingProfile,
    getPickupTypeFromStopActivity,
    getTimepointFromTimingStatus,
} from "../utils";

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

        if (!vehicleJourney.Frequency) {
            return null;
        }

        let headwaySecs = 0;
        let exactTimes = ServiceType.ScheduleBased;

        if (vehicleJourney.Frequency.Interval?.ScheduledFrequency) {
            headwaySecs = getDuration(vehicleJourney.Frequency.Interval.ScheduledFrequency).asSeconds();

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

        return dbClient.insertInto("frequency_new").values(newFrequency).returningAll().executeTakeFirst();
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
                            shape_pt_sequence: current_pt_sequence++,
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
        .execute();
};

export const insertStopTimes = async (
    dbClient: Kysely<Database>,
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const stopTimes = vehicleJourneyMappings.flatMap<NewStopTime>((vehicleJourneyMapping) => {
        const { vehicleJourney } = vehicleJourneyMapping;

        if (!vehicleJourney.VehicleJourneyTimingLink) {
            logger.warn(
                `No vehicle journey timing links found for vehicle journey with ref: ${vehicleJourney.LineRef}`,
            );
            return [];
        }

        let currentStopDepartureTime = getDateWithCustomFormat(vehicleJourney.DepartureTime, "HH:mm:ss"); // todo: check if this format works for all data

        return vehicleJourney.VehicleJourneyTimingLink.flatMap<NewStopTime>((timingLink) => {
            const journeyPatternTimingLink = txcJourneyPatternSections
                .flatMap((s) => s.JourneyPatternTimingLink)
                .find((link) => link["@_id"] === timingLink.JourneyPatternTimingLinkRef);

            if (!journeyPatternTimingLink) {
                logger.warn(
                    `Unable to find journey pattern timing link with ref: ${timingLink.JourneyPatternTimingLinkRef}`,
                );
                return [];
            }

            const stopPointRef = journeyPatternTimingLink.From?.StopPointRef || timingLink.From?.StopPointRef;

            if (!stopPointRef) {
                logger.warn(
                    `Missing stop point ref for journey pattern timing link with ref: ${timingLink.JourneyPatternTimingLinkRef}`,
                );
                return [];
            }

            const sequenceNumber =
                journeyPatternTimingLink.From?.["@_SequenceNumber"] || timingLink.From?.["@_SequenceNumber"];
            const activity = journeyPatternTimingLink.From?.Activity || timingLink.From?.Activity;
            const timingStatus = journeyPatternTimingLink.From?.TimingStatus || timingLink.From?.TimingStatus;
            const fromWaitTime = journeyPatternTimingLink.From?.WaitTime || timingLink.From?.WaitTime;
            const toWaitTime = journeyPatternTimingLink.To?.WaitTime || timingLink.To?.WaitTime;

            const arrivalTime = currentStopDepartureTime.clone();
            let departureTime = arrivalTime.clone();

            if (fromWaitTime) {
                departureTime = departureTime.add(getDuration(fromWaitTime));
            } else if (toWaitTime) {
                departureTime = departureTime.add(getDuration(toWaitTime));
            }

            let hasAddedRunTime = false;

            if (journeyPatternTimingLink.RunTime) {
                const journeyPatternTimingLinkRunTime = getDuration(journeyPatternTimingLink.RunTime);

                if (journeyPatternTimingLinkRunTime.asSeconds() > 0) {
                    currentStopDepartureTime = currentStopDepartureTime.add(journeyPatternTimingLinkRunTime);
                    hasAddedRunTime = true;
                }
            }

            if (timingLink.RunTime && !hasAddedRunTime) {
                const vehicleJourneyTimingLinkRunTime = getDuration(timingLink.RunTime);

                if (vehicleJourneyTimingLinkRunTime.asSeconds() > 0) {
                    currentStopDepartureTime = currentStopDepartureTime.add(vehicleJourneyTimingLinkRunTime);
                }
            }

            const newStopTime: NewStopTime = {
                trip_id: vehicleJourneyMapping.tripId,
                stop_id: stopPointRef,
                arrival_time: arrivalTime.format("HH:mm:ss"),
                departure_time: departureTime.format("HH:mm:ss"),
                stop_sequence: sequenceNumber || 0,
                stop_headsign: "",
                pickup_type: getPickupTypeFromStopActivity(activity),
                drop_off_type: getDropOffTypeFromStopActivity(activity),
                shape_dist_traveled: 0,
                timepoint: getTimepointFromTimingStatus(timingStatus),
            };

            return newStopTime;
        });
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
