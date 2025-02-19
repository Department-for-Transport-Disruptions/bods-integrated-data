import { KyselyDb, Route, RouteType } from "@bods-integrated-data/shared/database";
import { transit_realtime } from "@bods-integrated-data/shared/gtfs-realtime";
import { Consequence, PtSituationElement } from "@bods-integrated-data/shared/schema";
import { Condition, Severity, VehicleMode } from "@bods-integrated-data/shared/schema/siri-sx/enums";
import { describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import {
    getGtfsActivePeriods,
    getGtfsCause,
    getGtfsEffect,
    getGtfsInformedIdentities,
    getGtfsSeverityLevel,
    getRouteMap,
} from "./utils";

const { Cause, Effect, SeverityLevel } = transit_realtime.Alert;

describe("utils", () => {
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

    describe("getRouteMap", () => {
        let dbClient: KyselyDb;
        const getRoutesMock = vi.spyOn(databaseFunctions, "getRoutes");

        it("creates a route map for a given list of line refs", async () => {
            const mockRoutes: Route[] = [
                {
                    id: 1,
                    line_id: "r1",
                    agency_id: 10,
                    route_type: RouteType.Bus,
                },
                {
                    id: 2,
                    line_id: "r2",
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

            const expectedRouteMap: Record<string, transit_realtime.IEntitySelector> = {
                r1: {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                r2: {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            };

            const routeMap = await getRouteMap(dbClient, ptSituationElements);
            expect(routeMap).toEqual(expectedRouteMap);
        });
    });

    describe("getGtfsInformedIdentities", () => {
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

            const routeMap: Record<string, transit_realtime.IEntitySelector> = {
                r1: {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                r2: {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            };

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    stop_id: "1",
                },
                {
                    stop_id: "2",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, routeMap);
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

            const routeMap: Record<string, transit_realtime.IEntitySelector> = {
                r1: {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                r2: {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            };

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    stop_id: "1",
                },
                {
                    stop_id: "2",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, routeMap);
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
            } as Consequence;

            const routeMap: Record<string, transit_realtime.IEntitySelector> = {
                r1: {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                r2: {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            };

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

            const informedIdentities = getGtfsInformedIdentities(consequence, routeMap);
            expect(informedIdentities).toEqual(expectedInformedIdentities);
        });

        it("returns informed identities with only agency_id, route_id, route_type and stop_id when the consequence has affected lines and stops", () => {
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
                            {
                                AffectedLine: [
                                    {
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

            const routeMap: Record<string, transit_realtime.IEntitySelector> = {
                r1: {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                r2: {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            };

            const expectedInformedIdentities: transit_realtime.IEntitySelector[] = [
                {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                    stop_id: "1",
                },
                {
                    agency_id: "20",
                    route_id: "2",
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
                    stop_id: "2",
                },
            ];

            const informedIdentities = getGtfsInformedIdentities(consequence, routeMap);
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

            const routeMap: Record<string, transit_realtime.IEntitySelector> = {
                r1: {
                    agency_id: "10",
                    route_id: "1",
                    route_type: RouteType.Bus,
                },
                r2: {
                    agency_id: "20",
                    route_id: "2",
                    route_type: RouteType.Bus,
                },
            };

            const informedIdentities = getGtfsInformedIdentities(consequence, routeMap);
            expect(informedIdentities).toEqual([]);
        });
    });
});
