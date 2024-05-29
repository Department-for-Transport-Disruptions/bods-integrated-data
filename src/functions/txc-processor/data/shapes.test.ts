import { KyselyDb, NewShape } from "@bods-integrated-data/shared/database";
import { TxcRoute, TxcRouteLink, TxcRouteSection } from "@bods-integrated-data/shared/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as databaseFunctions from "./database";
import { getRouteLinks, getRouteRefs, mapRouteLinksToShapes, processShapes } from "./shapes";

describe("shapes", () => {
    let dbClient: KyselyDb;
    const insertShapesMock = vi.spyOn(databaseFunctions, "insertShapes");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe("getRouteRefs", () => {
        it("returns route refs for the given vehicle journeys and services", () => {
            const vehicleJourneyMappings: VehicleJourneyMapping[] = [
                {
                    routeId: 1,
                    serviceId: 2,
                    shapeId: "3",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "5",
                        ServiceRef: "6",
                        JourneyPatternRef: "7",
                        VehicleJourneyCode: "8",
                        DepartureTime: "00:00:00",
                        Operational: {
                            Block: {
                                BlockNumber: "block1",
                            },
                            TicketMachine: {
                                JourneyCode: "journey1",
                            },
                        },
                    },
                    journeyPattern: {
                        "@_id": "7",
                        DestinationDisplay: "service1",
                        RouteRef: "1",
                        JourneyPatternSectionRefs: [],
                    },
                },
                {
                    routeId: 11,
                    serviceId: 12,
                    shapeId: "13",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "15",
                        ServiceRef: "16",
                        JourneyPatternRef: "17",
                        VehicleJourneyCode: "18",
                        DepartureTime: "00:01:00",
                    },
                    journeyPattern: {
                        "@_id": "17",
                        RouteRef: "2",
                        JourneyPatternSectionRefs: [],
                    },
                },
            ];

            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: [],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: [],
                },
            ];

            const { routeRefs, journeyPatternToRouteRefMapping } = getRouteRefs(routes, vehicleJourneyMappings);

            expect(routeRefs).toEqual(["1", "2"]);
            expect(journeyPatternToRouteRefMapping).toEqual({
                "7": "1",
                "17": "2",
            });
        });

        it("doesn't return route refs that fail to reference routes", () => {
            const vehicleJourneyMappings: VehicleJourneyMapping[] = [
                {
                    routeId: 1,
                    serviceId: 2,
                    shapeId: "3",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "5",
                        ServiceRef: "6",
                        JourneyPatternRef: "7",
                        VehicleJourneyCode: "8",
                        DepartureTime: "00:00:00",
                        Operational: {
                            Block: {
                                BlockNumber: "block1",
                            },
                            TicketMachine: {
                                JourneyCode: "journey1",
                            },
                        },
                    },
                    journeyPattern: {
                        "@_id": "7",
                        DestinationDisplay: "service1",
                        RouteRef: "1",
                        JourneyPatternSectionRefs: [],
                    },
                },
                {
                    routeId: 11,
                    serviceId: 12,
                    shapeId: "13",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "15",
                        ServiceRef: "16",
                        JourneyPatternRef: "17",
                        VehicleJourneyCode: "18",
                        DepartureTime: "00:01:00",
                    },
                    journeyPattern: {
                        "@_id": "17",
                        RouteRef: "3",
                        JourneyPatternSectionRefs: [],
                    },
                },
            ];

            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: [],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: [],
                },
            ];

            const { routeRefs, journeyPatternToRouteRefMapping } = getRouteRefs(routes, vehicleJourneyMappings);

            expect(routeRefs).toEqual(["1"]);
            expect(journeyPatternToRouteRefMapping).toEqual({
                "7": "1",
            });
        });

        it("doesn't return route refs that fail to reference journey patterns", () => {
            const vehicleJourneyMappings: VehicleJourneyMapping[] = [
                {
                    routeId: 1,
                    serviceId: 2,
                    shapeId: "3",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "5",
                        ServiceRef: "6",
                        JourneyPatternRef: "7",
                        VehicleJourneyCode: "8",
                        DepartureTime: "00:00:00",
                        Operational: {
                            Block: {
                                BlockNumber: "block1",
                            },
                            TicketMachine: {
                                JourneyCode: "journey1",
                            },
                        },
                    },
                    journeyPattern: {
                        "@_id": "7",
                        DestinationDisplay: "service1",
                        RouteRef: "1",
                        JourneyPatternSectionRefs: [],
                    },
                },
                {
                    routeId: 11,
                    serviceId: 12,
                    shapeId: "13",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "15",
                        ServiceRef: "16",
                        JourneyPatternRef: "17",
                        VehicleJourneyCode: "18",
                        DepartureTime: "00:01:00",
                    },
                },
            ];

            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: [],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: [],
                },
            ];

            const { routeRefs, journeyPatternToRouteRefMapping } = getRouteRefs(routes, vehicleJourneyMappings);

            expect(routeRefs).toEqual(["1"]);
            expect(journeyPatternToRouteRefMapping).toEqual({
                "7": "1",
            });
        });
    });

    describe("getRouteLinks", () => {
        it("returns route links for the given route ref", () => {
            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: ["11"],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: ["12"],
                },
            ];

            const routeSections: TxcRouteSection[] = [
                {
                    "@_id": "11",
                    RouteLink: [
                        {
                            Track: [
                                {
                                    Mapping: {
                                        Location: [
                                            {
                                                Latitude: 1,
                                                Longitude: 2,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const routeLinks = getRouteLinks("1", routes, routeSections);
            expect(routeLinks).toEqual(routeSections[0].RouteLink);
        });

        it("returns an empty array when the route ref fails to reference a route section", () => {
            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: ["11"],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: ["12"],
                },
            ];

            const routeSections: TxcRouteSection[] = [
                {
                    "@_id": "12",
                    RouteLink: [
                        {
                            Track: [
                                {
                                    Mapping: {
                                        Location: [
                                            {
                                                Latitude: 1,
                                                Longitude: 2,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const routeLinks = getRouteLinks("1", routes, routeSections);
            expect(routeLinks).toEqual([]);
        });

        it("returns an empty array when the route ref fails to reference a route", () => {
            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: ["11"],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: ["12"],
                },
            ];

            const routeLinks = getRouteLinks("3", routes, []);
            expect(routeLinks).toEqual([]);
        });
    });

    describe("mapRouteLinksToShapes", () => {
        it("returns mapped shapes for a given set of route links", () => {
            const routeLinks: TxcRouteLink[] = [
                {
                    Track: [
                        {
                            Mapping: {
                                Location: [
                                    {
                                        Latitude: 1,
                                        Longitude: 2,
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    Track: [
                        {
                            Mapping: {
                                Location: [
                                    {
                                        Translation: {
                                            Latitude: 3,
                                            Longitude: 4,
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            ];

            const expectedShapes: NewShape[] = [
                {
                    shape_id: expect.any(String) as string,
                    shape_pt_lat: 1,
                    shape_pt_lon: 2,
                    shape_pt_sequence: 0,
                    shape_dist_traveled: 0,
                },
                {
                    shape_id: expect.any(String) as string,
                    shape_pt_lat: 3,
                    shape_pt_lon: 4,
                    shape_pt_sequence: 1,
                    shape_dist_traveled: 0,
                },
            ];

            const { shapeId, shapes } = mapRouteLinksToShapes(routeLinks);
            expect(shapeId).toEqual(expect.any(String));
            expect(shapes).toEqual(expectedShapes);
        });

        it("doesn't return mapped shapes when latitude or longitude are undefined", () => {
            const routeLinks: TxcRouteLink[] = [
                {
                    Track: [
                        {
                            Mapping: {
                                Location: [
                                    {
                                        Latitude: 1,
                                        Longitude: 2,
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    Track: [
                        {
                            Mapping: {
                                Location: [
                                    {
                                        Latitude: 3,
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    Track: [
                        {
                            Mapping: {
                                Location: [
                                    {
                                        Longitude: 4,
                                    },
                                ],
                            },
                        },
                    ],
                },
            ];

            const expectedShapes: NewShape[] = [
                {
                    shape_id: expect.any(String) as string,
                    shape_pt_lat: 1,
                    shape_pt_lon: 2,
                    shape_pt_sequence: 0,
                    shape_dist_traveled: 0,
                },
            ];

            const { shapes } = mapRouteLinksToShapes(routeLinks);
            expect(shapes).toEqual(expectedShapes);
        });

        it("doesn't return mapped shapes when there are no tracks", () => {
            const routeLinks: TxcRouteLink[] = [
                {
                    Track: [
                        {
                            Mapping: {
                                Location: [
                                    {
                                        Latitude: 1,
                                        Longitude: 2,
                                    },
                                ],
                            },
                        },
                    ],
                },
                {},
            ];

            const expectedShapes: NewShape[] = [
                {
                    shape_id: expect.any(String) as string,
                    shape_pt_lat: 1,
                    shape_pt_lon: 2,
                    shape_pt_sequence: 0,
                    shape_dist_traveled: 0,
                },
            ];

            const { shapes } = mapRouteLinksToShapes(routeLinks);
            expect(shapes).toEqual(expectedShapes);
        });
    });

    describe("processShapes", () => {
        it("inserts shapes into the database", async () => {
            const vehicleJourneyMappings: VehicleJourneyMapping[] = [
                {
                    routeId: 1,
                    serviceId: 2,
                    shapeId: "3",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "5",
                        ServiceRef: "6",
                        JourneyPatternRef: "7",
                        VehicleJourneyCode: "8",
                        DepartureTime: "00:00:00",
                        Operational: {
                            Block: {
                                BlockNumber: "block1",
                            },
                            TicketMachine: {
                                JourneyCode: "journey1",
                            },
                        },
                    },
                    journeyPattern: {
                        "@_id": "7",
                        DestinationDisplay: "service1",
                        RouteRef: "1",
                        JourneyPatternSectionRefs: [],
                    },
                },
                {
                    routeId: 11,
                    serviceId: 12,
                    shapeId: "13",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "15",
                        ServiceRef: "16",
                        JourneyPatternRef: "17",
                        VehicleJourneyCode: "18",
                        DepartureTime: "00:01:00",
                    },
                    journeyPattern: {
                        "@_id": "17",
                        RouteRef: "2",
                        JourneyPatternSectionRefs: [],
                    },
                },
            ];

            const routes: TxcRoute[] = [
                {
                    "@_id": "1",
                    RouteSectionRef: ["11"],
                },
                {
                    "@_id": "2",
                    RouteSectionRef: ["12"],
                },
            ];

            const routeSections: TxcRouteSection[] = [
                {
                    "@_id": "11",
                    RouteLink: [
                        {
                            Track: [
                                {
                                    Mapping: {
                                        Location: [
                                            {
                                                Latitude: 1,
                                                Longitude: 2,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    "@_id": "12",
                    RouteLink: [
                        {
                            Track: [
                                {
                                    Mapping: {
                                        Location: [
                                            {
                                                Translation: {
                                                    Latitude: 3,
                                                    Longitude: 4,
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const expectedShapes: NewShape[] = [
                {
                    shape_id: expect.any(String) as string,
                    shape_pt_lat: 1,
                    shape_pt_lon: 2,
                    shape_pt_sequence: 0,
                    shape_dist_traveled: 0,
                },
                {
                    shape_id: expect.any(String) as string,
                    shape_pt_lat: 3,
                    shape_pt_lon: 4,
                    shape_pt_sequence: 0,
                    shape_dist_traveled: 0,
                },
            ];

            insertShapesMock.mockImplementation(() => Promise.resolve());

            const updatedVehicleJourneyMappings = await processShapes(
                dbClient,
                routes,
                routeSections,
                vehicleJourneyMappings,
            );

            expect(insertShapesMock).toHaveBeenCalledWith(dbClient, expectedShapes);
            expect(updatedVehicleJourneyMappings[0].shapeId).not.toEqual(vehicleJourneyMappings[0].shapeId);
            expect(updatedVehicleJourneyMappings[1].shapeId).not.toEqual(vehicleJourneyMappings[1].shapeId);
        });

        it("doesn't insert shapes if none are mapped", async () => {
            const vehicleJourneyMappings: VehicleJourneyMapping[] = [
                {
                    routeId: 1,
                    serviceId: 2,
                    shapeId: "3",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "5",
                        ServiceRef: "6",
                        JourneyPatternRef: "7",
                        VehicleJourneyCode: "8",
                        DepartureTime: "00:00:00",
                        Operational: {
                            Block: {
                                BlockNumber: "block1",
                            },
                            TicketMachine: {
                                JourneyCode: "journey1",
                            },
                        },
                    },
                },
                {
                    routeId: 11,
                    serviceId: 12,
                    shapeId: "13",
                    tripId: "",
                    serviceCode: "test",
                    vehicleJourney: {
                        LineRef: "15",
                        ServiceRef: "16",
                        JourneyPatternRef: "17",
                        VehicleJourneyCode: "18",
                        DepartureTime: "00:01:00",
                    },
                },
            ];

            const updatedVehicleJourneyMappings = await processShapes(dbClient, [], [], vehicleJourneyMappings);

            expect(insertShapesMock).not.toHaveBeenCalled();
            expect(updatedVehicleJourneyMappings[0].shapeId).toEqual(vehicleJourneyMappings[0].shapeId);
            expect(updatedVehicleJourneyMappings[1].shapeId).toEqual(vehicleJourneyMappings[1].shapeId);
        });
    });
});
