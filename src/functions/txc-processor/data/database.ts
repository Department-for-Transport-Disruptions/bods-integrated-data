import { logger } from "@baselime/lambda-logger";
import {
    Agency,
    Database,
    LocationType,
    NewRoute,
    NewShape,
    getRouteTypeFromServiceMode,
    notEmpty,
} from "@bods-integrated-data/shared";
import {
    Operator,
    TxcRouteSection,
    Service,
    TxcStop,
    VehicleJourney,
    OperatingProfile,
    TxcRoute,
} from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { ServiceExpiredError } from "../errors";
import { formatCalendar } from "../utils";

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
    vehicleJourneys: VehicleJourney[],
) => {
    const promises = vehicleJourneys.flatMap(async (journey) => {
        try {
            const calendar = getOperatingProfile(service, journey);

            const journeyCalendar = await dbClient
                .insertInto("calendar_new")
                .values(calendar)
                .returningAll()
                .executeTakeFirst();

            if (!journeyCalendar) {
                return null;
            }
        } catch (e) {
            if (e instanceof ServiceExpiredError) {
                logger.warn(`Service expired: ${service.ServiceCode}`);
            }

            return null;
        }
    });

    const calendarData = await Promise.all(promises);

    return calendarData.filter(notEmpty);
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
    vehicleJourneys: VehicleJourney[],
) => {
    const shapes = vehicleJourneys.flatMap<NewShape>((journey) => {
        const service = services.find((s) => s.StandardService.JourneyPattern["@_id"] === journey.JourneyPatternRef);

        if (!service) {
            logger.warn(`Unable to find service with journey pattern ref: ${journey.JourneyPatternRef}`);
            return [];
        }

        const routeRef = service.StandardService.JourneyPattern.RouteRef;
        const txcRoute = routes.find((r) => r["@_id"] === routeRef);

        if (!txcRoute) {
            logger.warn(`Unable to find route with route ref: ${routeRef}`);
            return [];
        }

        return txcRoute.RouteSectionRef.flatMap<NewShape>((routeSectionRef) => {
            const routeSection = routeSections.find((rs) => rs["@_id"] === routeSectionRef);

            if (!routeSection) {
                logger.warn(`Unable to find route section with route section ref: ${routeSectionRef}`);
                return [];
            }

            let current_pt_sequence = 0;

            return routeSection.RouteLink.Track.Mapping.Location.map<NewShape>((location) => ({
                shape_id: routeSection.RouteLink["@_id"],
                shape_pt_lat: location.Translation.Latitude,
                shape_pt_lon: location.Translation.Longitude,
                shape_pt_sequence: current_pt_sequence++,
                shape_dist_traveled: 0,
            }));
        });
    });

    await dbClient.insertInto("shape_new").values(shapes).returningAll().executeTakeFirst();
};

export const insertStops = async (dbClient: Kysely<Database>, stops: TxcStop[]) => {
    const platformCodes = ["BCS", "PLT", "FBT"];
    const stopsPromises = stops.map(async (stop) => {
        const naptanStop = await dbClient
            .selectFrom("naptan_stop_new")
            .selectAll()
            .where("atco_code", "=", stop.StopPointRef)
            .executeTakeFirst();

        const newStop = {
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

        return dbClient
            .insertInto("stop_new")
            .values(newStop)
            .onConflict((oc) => oc.column("id").doUpdateSet(newStop))
            .returningAll()
            .executeTakeFirst();
    });

    const stopData = await Promise.all(stopsPromises);
    return stopData.filter(notEmpty);
};

const getOperatingProfile = (service: Service, vehicleJourney: VehicleJourney) => {
    const operatingPeriod = service.OperatingPeriod;
    const vehicleJourneyOperatingProfile = vehicleJourney.OperatingProfile;
    const serviceOperatingProfile = service.OperatingProfile;

    const operatingProfileToUse =
        vehicleJourneyOperatingProfile || serviceOperatingProfile || DEFAULT_OPERATING_PROFILE;

    return formatCalendar(operatingProfileToUse, operatingPeriod);
};

const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
    RegularDayType: {
        DaysOfWeek: {
            MondayToSunday: "",
        },
    },
};
