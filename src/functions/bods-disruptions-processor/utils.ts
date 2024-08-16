import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { Consequence, PtSituation } from "@bods-integrated-data/shared/schema";
import { transit_realtime } from "gtfs-realtime-bindings";

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

export const getGtfsCause = (ptSituation: PtSituation): transit_realtime.Alert.Cause => {
    const environmentReason = ptSituation.EnvironmentReason;
    const equipmentReason = ptSituation.EquipmentReason;
    const personnelReason = ptSituation.PersonnelReason;
    const miscellaneousReason = ptSituation.MiscellaneousReason;

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
    if (consequence.Blocking?.JourneyPlanner === "true") {
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

export const getGtfsActivePeriods = (ptSituation: PtSituation): transit_realtime.ITimeRange[] => {
    return ptSituation.ValidityPeriod.map((period) => ({
        start: getDate(period.StartTime).unix(),
        end: period.EndTime ? getDate(period.EndTime).unix() : undefined,
    }));
};

export const getAgency = (dbClient: KyselyDb, nationalOperatorCode: string) => {
    return dbClient.selectFrom("agency").selectAll().where("noc", "=", nationalOperatorCode).executeTakeFirst();
};

export const getRoute = (dbClient: KyselyDb, lineId: string) => {
    return dbClient.selectFrom("route").selectAll().where("line_id", "=", lineId).executeTakeFirst();
};

export const getGtfsInformedIdentities = async (
    dbClient: KyselyDb,
    consequence: Consequence,
): Promise<transit_realtime.IEntitySelector[]> => {
    /**
     * at the moment, all agencies/routes/stops are added as individual identities.
     * This will soon change so that:
     * 1. each stop is linked to its associated route and agency
     * 2. if a route lists no affected stops, then each route is linked to its associated agency
     * 3. if an agency has no affected routes, then it is listed on its own
     */
    const identities: transit_realtime.IEntitySelector[] = [];
    const operatorRefs = [];
    const lineRefs = [];

    if (consequence.Affects?.Networks?.AffectedNetwork) {
        for (const affectedNetwork of consequence.Affects.Networks.AffectedNetwork) {
            if (affectedNetwork.AffectedLine) {
                for (const affectedLine of affectedNetwork.AffectedLine) {
                    if (affectedLine.AffectedOperator?.OperatorRef) {
                        operatorRefs.push(affectedLine.AffectedOperator.OperatorRef);
                    }

                    lineRefs.push(affectedLine.LineRef);
                }
            }
        }
    }

    const agencies = await Promise.all(operatorRefs.map((operatorRef) => getAgency(dbClient, operatorRef)));
    const routes = await Promise.all(operatorRefs.map((lineRef) => getRoute(dbClient, lineRef)));

    for (const agency of agencies) {
        if (agency) {
            identities.push({
                agencyId: agency.id.toString(),
            });
        }
    }

    for (const route of routes) {
        if (route) {
            identities.push({
                agencyId: route.agency_id.toString(),
                routeId: route.id.toString(),
                routeType: route.route_type,
            });
        }
    }

    if (consequence.Affects?.StopPoints?.AffectedStopPoint) {
        for (const affectedStopPoint of consequence.Affects.StopPoints.AffectedStopPoint) {
            if (affectedStopPoint.StopPointRef) {
                identities.push({
                    stopId: affectedStopPoint.StopPointRef,
                });
            }
        }
    }

    return identities;
};
