import { KyselyDb, NewTrip, Trip, WheelchairAccessibility } from "@bods-integrated-data/shared/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as databaseFunctions from "./database";
import { processTrips } from "./trips";

describe("trips", () => {
    let dbClient: KyselyDb;
    const insertTripsMock = vi.spyOn(databaseFunctions, "insertTrips");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("inserts trips into the database", async () => {
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
                    DestinationDisplay: "vjDisplay1",
                },
                journeyPattern: {
                    "@_id": "1",
                    DestinationDisplay: "jpDisplay1",
                    JourneyPatternSectionRefs: [],
                    Direction: "inbound",
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
                    "@_id": "1",
                    JourneyPatternSectionRefs: [],
                },
            },
        ];

        const expectedTrips: NewTrip[] = [
            {
                id: expect.any(String) as string,
                route_id: 1,
                service_id: 2,
                block_id: "block1",
                shape_id: "3",
                trip_headsign: "vjDisplay1",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "8",
                ticket_machine_journey_code: "journey1",
                file_path: "",
                direction: "inbound",
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
                direction: "",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient, trips) => Promise.resolve(trips) as Promise<Trip[]>);

        const updatedVehicleJourneyMappings = await processTrips(dbClient, vehicleJourneyMappings, "");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
        expect(updatedVehicleJourneyMappings[0].tripId).toEqual(expectedTrips[0].id);
        expect(updatedVehicleJourneyMappings[1].tripId).toEqual(expectedTrips[1].id);
    });

    it("uses the journey pattern destination display when the vehicle journey destination display is omitted", async () => {
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
                    "@_id": "1",
                    DestinationDisplay: "jpDisplay1",
                    JourneyPatternSectionRefs: [],
                },
            },
        ];

        const expectedTrips: NewTrip[] = [
            {
                id: expect.any(String) as string,
                route_id: 1,
                service_id: 2,
                block_id: "block1",
                shape_id: "3",
                trip_headsign: "jpDisplay1",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "8",
                ticket_machine_journey_code: "journey1",
                file_path: "",
                direction: "",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient, trips) => Promise.resolve(trips) as Promise<Trip[]>);

        await processTrips(dbClient, vehicleJourneyMappings, "");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
    });

    it("doesn't insert trips into the database when the vehicle journey mapping is empty", async () => {
        await processTrips(dbClient, [], "");
        expect(insertTripsMock).not.toHaveBeenCalled();
    });
});
