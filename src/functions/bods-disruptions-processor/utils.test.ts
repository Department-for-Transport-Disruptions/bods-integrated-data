import { Agency, KyselyDb, Route, RouteType } from "@bods-integrated-data/shared/database";
import { transit_realtime } from "@bods-integrated-data/shared/gtfs-realtime";
import { Consequence, PtSituationElement } from "@bods-integrated-data/shared/schema";
import { Condition, Severity, VehicleMode } from "@bods-integrated-data/shared/schema/siri-sx/enums";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import {
    AgencyMap,
    RouteMap,
    getAgencyMap,
    getGtfsActivePeriods,
    getGtfsCause,
    getGtfsEffect,
    getGtfsInformedIdentities,
    getGtfsSeverityLevel,
    getRouteMap,
} from "./utils";

const { Cause, Effect, SeverityLevel } = transit_realtime.Alert;

describe("utils", () => {
    const dbClient = undefined as unknown as KyselyDb;

    describe("getGtfsCause", () => {
        it.each([
            [{ MiscellaneousReason: "accident" }, Cause.ACCIDENT],
            [{ EquipmentReason: "constructionWork" }, Cause.CONSTRUCTION],
            [{ MiscellaneousReason: "specialEvent" }, Cause.DEMONSTRATION],
            [{ EquipmentReason: "emergencyEngineeringWork" }, Cause.MAINTENANCE],
            [{ EquipmentReason: "maintenanceWork" }, Cause.MAINTENANCE],
            [{ EquipmentReason: "repairWork" }, Cause.MAINTENANCE],
            [{ MiscellaneousReason: "roadworks" }, Cause.MAINTENANCE],
            [{ EquipmentReason: "breakDown" }, Cause.OTHER_CAUSE],
            [{ EquipmentReason: "signalFailure" }, Cause.OTHER_CAUSE],
            [{ EquipmentReason: "signalProblem" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "congestion" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "incident" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "insufficientDemand" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "operatorCeasedTrading" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "overcrowded" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "roadClosed" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "routeDiversion" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "vandalism" }, Cause.OTHER_CAUSE],
            [{ MiscellaneousReason: "securityAlert" }, Cause.OTHER_CAUSE],
            [{ PersonnelReason: "industrialAction" }, Cause.STRIKE],
            [{ EquipmentReason: "escalatorFailure" }, Cause.TECHNICAL_PROBLEM],
            [{ EquipmentReason: "liftFailure" }, Cause.TECHNICAL_PROBLEM],
            [{ EnvironmentReason: "flooding" }, Cause.WEATHER],
            [{ EnvironmentReason: "fog" }, Cause.WEATHER],
            [{ EnvironmentReason: "heavyRain" }, Cause.WEATHER],
            [{ EnvironmentReason: "heavySnowFall" }, Cause.WEATHER],
            [{ EnvironmentReason: "highTemperatures" }, Cause.WEATHER],
            [{ EnvironmentReason: "ice" }, Cause.WEATHER],
            [{ EnvironmentReason: "asdf" }, Cause.UNKNOWN_CAUSE],
            [{ EquipmentReason: "asdf" }, Cause.UNKNOWN_CAUSE],
            [{ PersonnelReason: "asdf" }, Cause.UNKNOWN_CAUSE],
            [{ MiscellaneousReason: "asdf" }, Cause.UNKNOWN_CAUSE],
        ])("returns the correct cause", (input, expected) => {
            expect(getGtfsCause(input as PtSituationElement)).toEqual(expected);
        });
    });

    describe("getGtfsEffect", () => {
        it("returns the reduced service effect appropriately", () => {
            const input: Consequence = {
                Blocking: {
                    JourneyPlanner: true,
                },
                Advice: {
                    Details: "something reduced service something",
                },
                Condition: Condition.unknown,
                Severity: Severity.unknown,
            };

            expect(getGtfsEffect(input)).toEqual(Effect.REDUCED_SERVICE);
        });

        it.each(["detour", "reroute", "diversion", "diverted"])(
            "returns the detour effect appropriately",
            (details) => {
                const input: Consequence = {
                    Blocking: {
                        JourneyPlanner: true,
                    },
                    Advice: {
                        Details: details,
                    },
                    Condition: Condition.unknown,
                    Severity: Severity.unknown,
                };

                expect(getGtfsEffect(input)).toEqual(Effect.DETOUR);
            },
        );

        it("returns the modified service effect when there is at least one affected line", () => {
            const input: Consequence = {
                Blocking: {
                    JourneyPlanner: true,
                },
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                        ],
                                        LineRef: "1",
                                        PublishedLineName: "",
                                    },
                                ],
                                VehicleMode: VehicleMode.bus,
                            },
                        ],
                    },
                },
                Condition: Condition.unknown,
                Severity: Severity.unknown,
            };

            expect(getGtfsEffect(input)).toEqual(Effect.MODIFIED_SERVICE);
        });

        it("returns the modified service effect when there is at least one affected stop point", () => {
            const input: Consequence = {
                Blocking: {
                    JourneyPlanner: true,
                },
                Affects: {
                    StopPoints: {
                        AffectedStopPoint: [
                            {
                                StopPointRef: "1",
                            },
                        ],
                    },
                },
                Condition: Condition.unknown,
                Severity: Severity.unknown,
            };

            expect(getGtfsEffect(input)).toEqual(Effect.MODIFIED_SERVICE);
        });

        it.each(["asdf", ""])(
            "returns the other effect when the consequence is a journey planner but without known details",
            (details) => {
                const input: Consequence = {
                    Blocking: {
                        JourneyPlanner: true,
                    },
                    Advice: {
                        Details: details,
                    },
                    Condition: Condition.unknown,
                    Severity: Severity.unknown,
                };

                expect(getGtfsEffect(input)).toEqual(Effect.OTHER_EFFECT);
            },
        );

        it("returns the significant delays effect when a delay is present", () => {
            const input: Consequence = {
                Delays: {
                    Delay: "PT5M",
                },
                Condition: Condition.unknown,
                Severity: Severity.unknown,
            };

            expect(getGtfsEffect(input)).toEqual(Effect.SIGNIFICANT_DELAYS);
        });

        it("returns the unknown effect when a delay is present but set to 0", () => {
            const input: Consequence = {
                Delays: {
                    Delay: "PT0M",
                },
                Condition: Condition.unknown,
                Severity: Severity.unknown,
            };

            expect(getGtfsEffect(input)).toEqual(Effect.UNKNOWN_EFFECT);
        });

        it("returns the unknown effect when no other effect can be determined", () => {
            const input: Consequence = {
                Condition: Condition.unknown,
                Severity: Severity.unknown,
            };

            expect(getGtfsEffect(input)).toEqual(Effect.UNKNOWN_EFFECT);
        });
    });

    describe("getGtfsSeverityLevel", () => {
        it.each([
            ["normal", SeverityLevel.WARNING],
            ["slight", SeverityLevel.INFO],
            ["verySlight", SeverityLevel.INFO],
            ["severe", SeverityLevel.SEVERE],
            ["verySevere", SeverityLevel.SEVERE],
            ["asdf", SeverityLevel.UNKNOWN_SEVERITY],
        ])("returns the correct severity level", (input, expected) => {
            expect(getGtfsSeverityLevel(input)).toEqual(expected);
        });
    });

    describe("getGtfsActivePeriods", () => {
        it("returns correct active periods", () => {
            const input: PtSituationElement = {
                SituationNumber: "1",
                Consequences: {
                    Consequence: [],
                },
                ValidityPeriod: [
                    {
                        StartTime: "2024-08-05T07:00:00.000Z",
                        EndTime: "2024-08-05T08:00:00.000Z",
                    },
                    {
                        StartTime: "2024-08-05T09:00:00.000Z",
                    },
                ],
            } as unknown as PtSituationElement;

            const expected: transit_realtime.ITimeRange[] = [
                {
                    start: 1722841200,
                    end: 1722844800,
                },
                {
                    start: 1722848400,
                    end: undefined,
                },
            ];
            const result = getGtfsActivePeriods(input);
            expect(result).toEqual(expected);
        });
    });

    describe("getAgencyMap", () => {
        const getAgenciesMock = vi.spyOn(databaseFunctions, "getAgencies");

        afterEach(() => {
            vi.resetAllMocks();
        });

        it("creates an agency map for a given list of line refs", async () => {
            const mockAgencies: Agency[] = [
                {
                    id: 1,
                    noc: "o1",
                },
                {
                    id: 2,
                    noc: "o2",
                },
            ] as Agency[];

            getAgenciesMock.mockResolvedValueOnce(mockAgencies);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Operators: {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                            {
                                                OperatorRef: "o2",
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const expectedAgencyMap: AgencyMap = {
                o1: {
                    agency_id: "1",
                },
                o2: {
                    agency_id: "2",
                },
            };

            const agencyMap = await getAgencyMap(dbClient, ptSituationElements);
            expect(agencyMap).toEqual(expectedAgencyMap);
        });

        it("returns an empty map when there are no operator refs", async () => {
            const mockAgencies: Agency[] = [
                {
                    id: 1,
                    noc: "o1",
                },
                {
                    id: 2,
                    noc: "o2",
                },
            ] as Agency[];

            getAgenciesMock.mockResolvedValueOnce(mockAgencies);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [{}],
                    },
                },
            ] as PtSituationElement[];

            const agencyMap = await getAgencyMap(dbClient, ptSituationElements);
            expect(agencyMap).toEqual({});
        });

        it("returns an empty map when no agencies are matched in the database", async () => {
            getAgenciesMock.mockResolvedValueOnce([]);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Operators: {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                            {
                                                OperatorRef: "o2",
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const agencyMap = await getAgencyMap(dbClient, ptSituationElements);
            expect(agencyMap).toEqual({});
        });
    });

    describe("getRouteMap", () => {
        const agencyMap: AgencyMap = {
            o1: {
                agency_id: "10",
            },
            o2: {
                agency_id: "20",
            },
            o3: {
                agency_id: "30",
            },
        };
        const getRoutesMock = vi.spyOn(databaseFunctions, "getRoutes");

        afterEach(() => {
            vi.resetAllMocks();
        });

        it("creates a route map for a given list of line refs", async () => {
            const mockRoutes: Route[] = [
                {
                    id: 1,
                    route_short_name: "r1",
                    agency_id: 10,
                    route_type: RouteType.Bus,
                },
                {
                    id: 2,
                    route_short_name: "r2",
                    agency_id: 20,
                    route_type: RouteType.Bus,
                },
            ] as Route[];

            getRoutesMock.mockResolvedValueOnce(mockRoutes);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Networks: {
                                        AffectedNetwork: [
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o1",
                                                            },
                                                        ],
                                                        LineRef: "r1",
                                                    },
                                                ],
                                            },
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o2",
                                                            },
                                                        ],
                                                        LineRef: "r2",
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const expectedRouteMap: RouteMap = {
                r1: {
                    "10": {
                        agency_id: "10",
                        route_id: "1",
                        route_type: RouteType.Bus,
                    },
                },
                r2: {
                    "20": {
                        agency_id: "20",
                        route_id: "2",
                        route_type: RouteType.Bus,
                    },
                },
            };

            const routeMap = await getRouteMap(dbClient, agencyMap, ptSituationElements);
            expect(routeMap).toEqual(expectedRouteMap);
        });

        it("returns an empty map when there are no agencies", async () => {
            const mockRoutes: Route[] = [
                {
                    id: 1,
                    route_short_name: "r1",
                    agency_id: 10,
                    route_type: RouteType.Bus,
                },
                {
                    id: 2,
                    route_short_name: "r2",
                    agency_id: 20,
                    route_type: RouteType.Bus,
                },
            ] as Route[];

            getRoutesMock.mockResolvedValueOnce(mockRoutes);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [{}],
                    },
                },
            ] as PtSituationElement[];

            const routeMap = await getRouteMap(dbClient, agencyMap, ptSituationElements);
            expect(routeMap).toEqual({});
        });

        it("returns an empty map when there are no line refs", async () => {
            const mockRoutes: Route[] = [
                {
                    id: 1,
                    route_short_name: "r1",
                    agency_id: 10,
                    route_type: RouteType.Bus,
                },
                {
                    id: 2,
                    route_short_name: "r2",
                    agency_id: 20,
                    route_type: RouteType.Bus,
                },
            ] as Route[];

            getRoutesMock.mockResolvedValueOnce(mockRoutes);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Networks: {
                                        AffectedNetwork: [
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o1",
                                                            },
                                                        ],
                                                        LineRef: "r1",
                                                    },
                                                ],
                                            },
                                            {
                                                AffectedLine: [
                                                    {
                                                        LineRef: "r2",
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const routeMap = await getRouteMap(dbClient, {}, ptSituationElements);
            expect(routeMap).toEqual({});
        });

        it("returns an empty map when no routes are matched in the database", async () => {
            getRoutesMock.mockResolvedValueOnce([]);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Networks: {
                                        AffectedNetwork: [
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o1",
                                                            },
                                                        ],
                                                        LineRef: "r1",
                                                    },
                                                ],
                                            },
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o2",
                                                            },
                                                        ],
                                                        LineRef: "r2",
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const routeMap = await getRouteMap(dbClient, agencyMap, ptSituationElements);
            expect(routeMap).toEqual({});
        });

        it("returns an empty map when the affected line has no affected operator", async () => {
            const mockRoutes: Route[] = [
                {
                    id: 1,
                    route_short_name: "r1",
                    agency_id: 10,
                    route_type: RouteType.Bus,
                },
                {
                    id: 2,
                    route_short_name: "r2",
                    agency_id: 20,
                    route_type: RouteType.Bus,
                },
            ] as Route[];

            getRoutesMock.mockResolvedValueOnce(mockRoutes);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Networks: {
                                        AffectedNetwork: [
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o1",
                                                            },
                                                        ],
                                                        LineRef: "r1",
                                                    },
                                                ],
                                            },
                                            {
                                                AffectedLine: [
                                                    {
                                                        LineRef: "r2",
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const expectedRouteMap: RouteMap = {
                r1: {
                    "10": {
                        agency_id: "10",
                        route_id: "1",
                        route_type: RouteType.Bus,
                    },
                },
            };

            const routeMap = await getRouteMap(dbClient, agencyMap, ptSituationElements);
            expect(routeMap).toEqual(expectedRouteMap);
        });

        it("returns a route map when the affected line has multiple affected operators", async () => {
            const mockRoutes: Route[] = [
                {
                    id: 1,
                    route_short_name: "r1",
                    agency_id: 10,
                    route_type: RouteType.Bus,
                },
                {
                    id: 2,
                    route_short_name: "r2",
                    agency_id: 20,
                    route_type: RouteType.Bus,
                },
                {
                    id: 3,
                    route_short_name: "r1",
                    agency_id: 30,
                    route_type: RouteType.Bus,
                },
            ] as Route[];

            getRoutesMock.mockResolvedValueOnce(mockRoutes);

            const ptSituationElements: PtSituationElement[] = [
                {
                    Consequences: {
                        Consequence: [
                            {
                                Affects: {
                                    Networks: {
                                        AffectedNetwork: [
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o1",
                                                            },
                                                            {
                                                                OperatorRef: "o3",
                                                            },
                                                        ],
                                                        LineRef: "r1",
                                                    },
                                                ],
                                            },
                                            {
                                                AffectedLine: [
                                                    {
                                                        AffectedOperator: [
                                                            {
                                                                OperatorRef: "o2",
                                                            },
                                                        ],
                                                        LineRef: "r2",
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ] as PtSituationElement[];

            const expectedRouteMap: RouteMap = {
                r1: {
                    "10": {
                        agency_id: "10",
                        route_id: "1",
                        route_type: RouteType.Bus,
                    },
                    "30": {
                        agency_id: "30",
                        route_id: "3",
                        route_type: RouteType.Bus,
                    },
                },
                r2: {
                    "20": {
                        agency_id: "20",
                        route_id: "2",
                        route_type: RouteType.Bus,
                    },
                },
            };

            const routeMap = await getRouteMap(dbClient, agencyMap, ptSituationElements);
            expect(routeMap).toEqual(expectedRouteMap);
        });
    });

    describe("getGtfsInformedIdentities", () => {
        const agencyMap: AgencyMap = {
            o1: {
                agency_id: "10",
            },
            o2: {
                agency_id: "20",
            },
            o3: {
                agency_id: "30",
            },
        };

        const routeMap: RouteMap = {
            r1: {
                "10": {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                "30": {
                    agency_id: "20",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
            },
            r2: {
                "20": {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            },
        };

        it("returns informed identities with only agency_id when the consequence affects all operators", () => {
            const consequence: Consequence = {
                Affects: {
                    Operators: {
                        AffectedOperator: [
                            {
                                OperatorRef: "o1",
                            },
                            {
                                OperatorRef: "o2",
                            },
                        ],
                    },
                },
            } as Consequence;

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    agency_id: "10",
                },
                {
                    agency_id: "20",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });

        it("returns informed identities with only agency_id, route_id and route_type when the consequence has no affected stops", () => {
            const consequence: Consequence = {
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                        ],
                                        LineRef: "r1",
                                    },
                                ],
                            },
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o2",
                                            },
                                        ],
                                        LineRef: "r2",
                                    },
                                ],
                            },
                        ],
                    },
                },
            } as Consequence;

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });

        it("returns informed identities with agency_id, route_id, route_type and stop_id when the consequence has affected lines and stops", () => {
            const consequence: Consequence = {
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                        ],
                                        LineRef: "r1",
                                    },
                                ],
                            },
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o2",
                                            },
                                        ],
                                        LineRef: "r2",
                                    },
                                ],
                            },
                        ],
                    },
                    StopPoints: {
                        AffectedStopPoint: [
                            {
                                StopPointRef: "1",
                            },
                            {
                                StopPointRef: "2",
                            },
                        ],
                    },
                },
            } as Consequence;

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                    stop_id: "1",
                },
                {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                    stop_id: "2",
                },
                {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                    stop_id: "1",
                },
                {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                    stop_id: "2",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });

        it("returns informed identities with only stop_id when the consequence affects all lines", () => {
            const consequence: Consequence = {
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AllLines: "",
                            },
                        ],
                    },
                    StopPoints: {
                        AffectedStopPoint: [
                            {
                                StopPointRef: "1",
                            },
                            {
                                StopPointRef: "2",
                            },
                        ],
                    },
                },
            } as Consequence;

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    stop_id: "1",
                },
                {
                    stop_id: "2",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });

        it("returns informed identities with only stop_id when the consequence has no affected lines", () => {
            const consequence: Consequence = {
                Affects: {
                    StopPoints: {
                        AffectedStopPoint: [
                            {
                                StopPointRef: "1",
                            },
                            {
                                StopPointRef: "2",
                            },
                        ],
                    },
                },
            } as Consequence;

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    stop_id: "1",
                },
                {
                    stop_id: "2",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });

        it("returns no informed identities when the consequence affects a whole network", () => {
            const consequence: Consequence = {
                Affects: {
                    Operators: {
                        AllOperators: "",
                    },
                },
            } as Consequence;

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual([]);
        });

        it("returns no informed identities when the consequence affects all operators but no agencies are matched in the database", () => {
            const consequence: Consequence = {
                Affects: {
                    Operators: {
                        AffectedOperator: [
                            {
                                OperatorRef: "o1",
                            },
                            {
                                OperatorRef: "o2",
                            },
                        ],
                    },
                },
            } as Consequence;

            const informedIdentities = getGtfsInformedIdentities(consequence, {}, routeMap);
            expect(informedIdentities).toEqual([]);
        });

        it("returns no informed identities when the consequence has lines but no routes are matched in the database", () => {
            const consequence: Consequence = {
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                        ],
                                        LineRef: "r1",
                                    },
                                ],
                            },
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o2",
                                            },
                                        ],
                                        LineRef: "r2",
                                    },
                                ],
                            },
                        ],
                    },
                },
            } as Consequence;

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, {});
            expect(informedIdentities).toEqual([]);
        });

        it("returns no informed identities when the affected line has no affected operator", () => {
            const consequence: Consequence = {
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AffectedLine: [
                                    {
                                        LineRef: "r1",
                                    },
                                ],
                            },
                        ],
                    },
                },
            } as Consequence;

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual([]);
        });

        it("returns informed identities with multiple operators for the same line", () => {
            const consequence: Consequence = {
                Affects: {
                    Networks: {
                        AffectedNetwork: [
                            {
                                AffectedLine: [
                                    {
                                        AffectedOperator: [
                                            {
                                                OperatorRef: "o1",
                                            },
                                            {
                                                OperatorRef: "o3",
                                            },
                                        ],
                                        LineRef: "r1",
                                    },
                                ],
                            },
                        ],
                    },
                },
            } as Consequence;

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                {
                    agency_id: "30",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, agencyMap, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });
    });
});
