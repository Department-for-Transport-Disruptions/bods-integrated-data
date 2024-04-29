import { Database, NewTrip, Route, Trip, WheelchairAccessibility } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import { processTrips } from "./trips";
import { VehicleJourneyMapping } from "../types";

describe("trips", () => {
    let dbClient: Kysely<Database>;
    const insertTripsMock = vi.spyOn(databaseFunctions, "insertTrips");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("inserts trips into the database and returns them", async () => {
        const services: Service[] = [
            {
                StandardService: {
                    JourneyPattern: [
                        {
                            "@_id": "7",
                            DestinationDisplay: "service1",
                        },
                    ],
                },
            },
            {
                StandardService: {
                    JourneyPattern: [
                        {
                            "@_id": "17",
                        },
                    ],
                },
            },
        ] as Service[];

        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "",
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
                vehicleJourney: {
                    LineRef: "15",
                    ServiceRef: "16",
                    JourneyPatternRef: "17",
                    VehicleJourneyCode: "18",
                    DepartureTime: "00:01:00",
                },
            },
        ];

        const routes: Route[] = [
            {
                line_id: "5",
            },
            {
                line_id: "15",
            },
        ] as Route[];

        const expectedTrips: NewTrip[] = [
            {
                id: expect.any(String) as string,
                route_id: 1,
                service_id: 2,
                block_id: "block1",
                shape_id: "3",
                trip_headsign: "service1",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "8",
                ticket_machine_journey_code: "journey1",
                file_path: "",
            },
            {
                id: expect.any(String) as string,
                route_id: 11,
                service_id: 12,
                block_id: "",
                shape_id: "13",
                trip_headsign: "",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "18",
                ticket_machine_journey_code: "",
                file_path: "",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient, trips) => Promise.resolve(trips) as Promise<Trip[]>);

        const updatedVehicleJourneyMappings = await processTrips(
            dbClient,
            services,
            vehicleJourneyMappings,
            routes,
            "",
        );

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
        expect(updatedVehicleJourneyMappings[0].tripId).toEqual(expectedTrips[0].id);
        expect(updatedVehicleJourneyMappings[1].tripId).toEqual(expectedTrips[1].id);
    });

    it("doesn't insert trips that fail to reference a route", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "",
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
        ];

        insertTripsMock.mockImplementation((_dbClient, trips) => Promise.resolve(trips) as Promise<Trip[]>);

        const updatedVehicleJourneyMappings = await processTrips(dbClient, [], vehicleJourneyMappings, [], "");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, []);
        expect(updatedVehicleJourneyMappings[0].tripId).toEqual("");
    });

    it("doesn't insert trips that fail to reference a journey pattern", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "",
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
        ];

        const routes: Route[] = [
            {
                line_id: "5",
            },
        ] as Route[];

        insertTripsMock.mockImplementation((_dbClient, trips) => Promise.resolve(trips) as Promise<Trip[]>);

        const updatedVehicleJourneyMappings = await processTrips(dbClient, [], vehicleJourneyMappings, routes, "");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, []);
        expect(updatedVehicleJourneyMappings[0].tripId).toEqual("");
    });
});
