import { KyselyDb, NewTrip, WheelchairAccessibility } from "@bods-integrated-data/shared/database";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as databaseFunctions from "./database";
import { getGtfsDirectionId, processTrips } from "./trips";

describe("trips", () => {
    MockDate.set("2024-02-10");

    let dbClient: KyselyDb;
    const insertTripsMock = vi.spyOn(databaseFunctions, "insertTrips");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
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
                    "@_RevisionNumber": "2",
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
                direction: "1",
                departure_time: "00:00:00z",
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
                revision_number: "2",
                departure_time: "00:01:00z",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient) => Promise.resolve());

        const updatedVehicleJourneyMappings = await processTrips(dbClient, vehicleJourneyMappings, "");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
        expect(updatedVehicleJourneyMappings[0].tripId).toEqual(expectedTrips[0].id);
        expect(updatedVehicleJourneyMappings[1].tripId).toEqual(expectedTrips[1].id);
    });

    it("uses the journey pattern destination display when the vehicle journey destination display is omitted", async () => {
        MockDate.set("2024-06-10");

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
                    DepartureTime: "06:00:00",
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
                departure_time: "05:00:00z",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient) => Promise.resolve());

        await processTrips(dbClient, vehicleJourneyMappings, "");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
    });

    it("doesn't insert trips into the database when the vehicle journey mapping is empty", async () => {
        await processTrips(dbClient, [], "");
        expect(insertTripsMock).not.toHaveBeenCalled();
    });

    describe("getGtfsDirectionId", () => {
        it.each([
            ["outbound", "0"],
            ["inbound", "1"],
            ["clockwise", "0"],
            ["antiClockwise", "1"],
            ["unknown", ""],
            ["", ""],
            [undefined, ""],
        ])("correctly maps the journey pattern direction %s to GTFS direction ID %s", (input, expected) => {
            expect(getGtfsDirectionId(input)).toEqual(expected);
        });
    });
});
