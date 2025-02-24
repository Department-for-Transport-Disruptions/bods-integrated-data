import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { transit_realtime } from "@bods-integrated-data/shared/gtfs-realtime";
import { Consequence, PtSituationElement } from "@bods-integrated-data/shared/schema";
import { getAgencies, getRoutes } from "./database";

const { Cause, Effect, SeverityLevel } = transit_realtime.Alert;

const environmentReasonAliases = {
    flooding: "pti22_13",
    fog: "pti22_1",
    heavyRain: "pti22_4",
    heavySnowFall: "pti22_3",
    highTemperatures: "pti22_12",
    ice: "pti22_9",
} as const;

const equipmentReasonAliases = {
    breakDown: "pti21_7",
    constructionWork: "pti21_10",
    emergencyEngineeringWork: "pti21_11_Alias_1",
    escalatorFailure: "pti21_15",
    liftFailure: "pti21_16",
    maintenanceWork: "pti21_11",
    repairWork: "pti21_9",
    signalFailure: "pti21_4",
    signalProblem: "pti21_3",
} as const;

const miscellaneousReasonAliases = {
    accident: "pti19_6",
    congestion: "pti19_15",
    incident: "pti19_1",
    insufficientDemand: "pti19_8",
    operatorCeasedTrading: "pti19_13",
    overcrowded: "pti19_7",
    roadClosed: "pti19_22",
    roadworks: "pti19_23",
    routeDiversion: "pti19_21",
    securityAlert: "pti19_3",
    specialEvent: "pti19_24",
    vandalism: "pti19_5",
} as const;

const personnelReasonAliases = {
    industrialAction: "pti20_5",
} as const;

const isReason = <T extends Record<string, string>>(reasonAliases: T, reasonToCheck: keyof T, reason?: string) => {
    return reason && (reason === reasonToCheck || reason === reasonAliases[reasonToCheck]);
};

export const getGtfsCause = (ptSituation: PtSituationElement): transit_realtime.Alert.Cause => {
    const environmentReason = "EnvironmentReason" in ptSituation ? ptSituation.EnvironmentReason : undefined;
    const equipmentReason = "EquipmentReason" in ptSituation ? ptSituation.EquipmentReason : undefined;
    const personnelReason = "PersonnelReason" in ptSituation ? ptSituation.PersonnelReason : undefined;
    const miscellaneousReason = "MiscellaneousReason" in ptSituation ? ptSituation.MiscellaneousReason : undefined;

    if (isReason(miscellaneousReasonAliases, "accident", miscellaneousReason)) {
        return Cause.ACCIDENT;
    }

    if (isReason(equipmentReasonAliases, "constructionWork", equipmentReason)) {
        return Cause.CONSTRUCTION;
    }

    if (isReason(miscellaneousReasonAliases, "specialEvent", miscellaneousReason)) {
        return Cause.DEMONSTRATION;
    }

    if (
        isReason(equipmentReasonAliases, "emergencyEngineeringWork", equipmentReason) ||
        isReason(equipmentReasonAliases, "maintenanceWork", equipmentReason) ||
        isReason(equipmentReasonAliases, "repairWork", equipmentReason) ||
        isReason(miscellaneousReasonAliases, "roadworks", miscellaneousReason)
    ) {
        return Cause.MAINTENANCE;
    }

    if (
        isReason(equipmentReasonAliases, "breakDown", equipmentReason) ||
        isReason(equipmentReasonAliases, "signalFailure", equipmentReason) ||
        isReason(equipmentReasonAliases, "signalProblem", equipmentReason) ||
        isReason(miscellaneousReasonAliases, "congestion", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "incident", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "insufficientDemand", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "operatorCeasedTrading", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "overcrowded", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "roadClosed", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "routeDiversion", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "vandalism", miscellaneousReason) ||
        isReason(miscellaneousReasonAliases, "securityAlert", miscellaneousReason)
    ) {
        return Cause.OTHER_CAUSE;
    }

    if (isReason(personnelReasonAliases, "industrialAction", personnelReason)) {
        return Cause.STRIKE;
    }

    if (
        isReason(equipmentReasonAliases, "escalatorFailure", equipmentReason) ||
        isReason(equipmentReasonAliases, "liftFailure", equipmentReason)
    ) {
        return Cause.TECHNICAL_PROBLEM;
    }

    if (
        isReason(environmentReasonAliases, "flooding", environmentReason) ||
        isReason(environmentReasonAliases, "fog", environmentReason) ||
        isReason(environmentReasonAliases, "heavyRain", environmentReason) ||
        isReason(environmentReasonAliases, "heavySnowFall", environmentReason) ||
        isReason(environmentReasonAliases, "highTemperatures", environmentReason) ||
        isReason(environmentReasonAliases, "ice", environmentReason)
    ) {
        return Cause.WEATHER;
    }

    return Cause.UNKNOWN_CAUSE;
};

export const getGtfsEffect = (consequence: Consequence): transit_realtime.Alert.Effect => {
    if (consequence.Blocking?.JourneyPlanner) {
        const details = consequence.Advice?.Details.toLowerCase() || "";

        if (details.includes("reduced service")) {
            return Effect.REDUCED_SERVICE;
        }

        if (
            details.includes("detour") ||
            details.includes("reroute") ||
            details.includes("diversion") ||
            details.includes("diverted")
        ) {
            return Effect.DETOUR;
        }

        if (isModifiedService(consequence)) {
            return Effect.MODIFIED_SERVICE;
        }

        return Effect.OTHER_EFFECT;
    }

    if (consequence.Delays?.Delay && consequence.Delays.Delay !== "PT0M") {
        return Effect.SIGNIFICANT_DELAYS;
    }

    return Effect.UNKNOWN_EFFECT;
};

const isModifiedService = (consequence: Consequence) => {
    if (consequence.Affects?.Networks?.AffectedNetwork) {
        for (const affectedNetwork of consequence.Affects.Networks.AffectedNetwork) {
            if (affectedNetwork.AffectedLine && affectedNetwork.AffectedLine.length > 0) {
                return true;
            }
        }
    }

    if (
        consequence.Affects?.StopPoints?.AffectedStopPoint &&
        consequence.Affects.StopPoints.AffectedStopPoint.length > 0
    ) {
        return true;
    }

    return false;
};

export const getGtfsSeverityLevel = (severity: string): transit_realtime.Alert.SeverityLevel => {
    if (severity === "normal") {
        return SeverityLevel.WARNING;
    }

    if (severity === "slight" || severity === "verySlight") {
        return SeverityLevel.INFO;
    }

    if (severity === "severe" || severity === "verySevere") {
        return SeverityLevel.SEVERE;
    }

    return SeverityLevel.UNKNOWN_SEVERITY;
};

export const getGtfsActivePeriods = (ptSituation: PtSituationElement): transit_realtime.ITimeRange[] => {
    return ptSituation.ValidityPeriod.map((period) => ({
        start: getDate(period.StartTime).unix(),
        end: period.EndTime ? getDate(period.EndTime).unix() : undefined,
    }));
};

/**
 * Takes a list of situations and returns a collated map of operator refs with their
 * corresponding agency_id values from the database.
 */
export const getAgencyMap = async (dbClient: KyselyDb, ptSituations: PtSituationElement[]) => {
    const operatorRefs = new Set<string>();

    for (const ptSituation of ptSituations) {
        if (ptSituation.Consequences?.Consequence) {
            for (const consequence of ptSituation.Consequences.Consequence) {
                if (consequence.Affects?.Operators?.AffectedOperator) {
                    for (const affectedOperator of consequence.Affects.Operators.AffectedOperator) {
                        operatorRefs.add(affectedOperator.OperatorRef);
                    }
                }
            }
        }
    }

    if (operatorRefs.size === 0) {
        return {};
    }

    const agencies = await getAgencies(dbClient, Array.from(operatorRefs));
    const agencyMap: Record<string, transit_realtime.IEntitySelector> = {};

    for (const agency of agencies) {
        agencyMap[agency.noc] = {
            agency_id: agency.id.toString(),
        };
    }

    return agencyMap;
};

/**
 * Takes a list of situations and returns a collated map of line refs with their
 * corresponding route_id and agency_id values from the database.
 */
export const getRouteMap = async (dbClient: KyselyDb, ptSituations: PtSituationElement[]) => {
    const lineRefs = new Set<string>();

    for (const ptSituation of ptSituations) {
        if (ptSituation.Consequences?.Consequence) {
            for (const consequence of ptSituation.Consequences.Consequence) {
                if (consequence.Affects?.Networks?.AffectedNetwork) {
                    for (const affectedNetwork of consequence.Affects.Networks.AffectedNetwork) {
                        if (affectedNetwork.AffectedLine) {
                            for (const affectedLine of affectedNetwork.AffectedLine) {
                                lineRefs.add(affectedLine.LineRef);
                            }
                        }
                    }
                }
            }
        }
    }

    if (lineRefs.size === 0) {
        return {};
    }

    const routes = await getRoutes(dbClient, Array.from(lineRefs));
    const routeMap: Record<string, transit_realtime.IEntitySelector> = {};

    for (const route of routes) {
        routeMap[route.route_short_name] = {
            agency_id: route.agency_id.toString(),
            route_id: route.id.toString(),
            route_type: route.route_type,
        };
    }

    return routeMap;
};

/**
 * Informed identities are created with a combination of agency_id, route_id, route_type, and
 * stop_id depending on the information available about operators, lines and stops in a consequence.
 * The possible variations:
 * 1. operators only = identities with agency_id
 * 2. lines only = identities with agency_id, route_id
 * 3. stops only = identities with stop_id
 * 1. lines and stops = identities with agency_id, route_id, stop_id
 *
 * Note that network-wide consequences (no operators, lines or stops) are discarded because GTFS service
 * alerts do not allow a network to be restricted to a geography (typically used in siri-sx).
 */
export const getGtfsInformedIdentities = (
    consequence: Consequence,
    agencyMap: Record<string, transit_realtime.IEntitySelector>,
    routeMap: Record<string, transit_realtime.IEntitySelector>,
) => {
    const informedIdentities: transit_realtime.IEntitySelector[] = [];
    const operatorRefs = new Set<string>();
    const lineRefs = new Set<string>();
    const stopPointRefs = new Set<string>();

    if (consequence.Affects?.Operators?.AffectedOperator) {
        for (const affectedOperator of consequence.Affects.Operators.AffectedOperator) {
            operatorRefs.add(affectedOperator.OperatorRef);
        }
    }

    if (consequence.Affects?.Networks?.AffectedNetwork) {
        for (const affectedNetwork of consequence.Affects.Networks.AffectedNetwork) {
            if (affectedNetwork.AffectedLine) {
                for (const affectedLine of affectedNetwork.AffectedLine) {
                    lineRefs.add(affectedLine.LineRef);
                }
            }
        }
    }

    if (consequence.Affects?.StopPoints?.AffectedStopPoint) {
        for (const affectedStopPoint of consequence.Affects.StopPoints.AffectedStopPoint) {
            if (affectedStopPoint.StopPointRef) {
                stopPointRefs.add(affectedStopPoint.StopPointRef);
            }
        }
    }

    if (operatorRefs.size > 0 && lineRefs.size === 0 && stopPointRefs.size === 0) {
        for (const operatorRef of operatorRefs) {
            if (agencyMap[operatorRef]) {
                informedIdentities.push({
                    agency_id: agencyMap[operatorRef].agency_id,
                });
            }
        }
    } else if (lineRefs.size > 0 && stopPointRefs.size === 0) {
        for (const lineRef of lineRefs) {
            if (routeMap[lineRef]) {
                informedIdentities.push({
                    agency_id: routeMap[lineRef].agency_id,
                    route_id: routeMap[lineRef].route_id,
                    route_type: routeMap[lineRef].route_type,
                });
            }
        }
    } else if (lineRefs.size > 0 && stopPointRefs.size > 0) {
        for (const lineRef of lineRefs) {
            if (routeMap[lineRef]) {
                for (const stopPointRef of stopPointRefs) {
                    informedIdentities.push({
                        agency_id: routeMap[lineRef].agency_id,
                        route_id: routeMap[lineRef].route_id,
                        route_type: routeMap[lineRef].route_type,
                        stop_id: stopPointRef,
                    });
                }
            }
        }
    } else if (stopPointRefs.size > 0) {
        for (const stopPointRef of stopPointRefs) {
            informedIdentities.push({
                stop_id: stopPointRef,
            });
        }
    }

    return informedIdentities;
};
