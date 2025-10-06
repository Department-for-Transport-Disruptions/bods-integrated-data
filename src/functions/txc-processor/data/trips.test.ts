import { KyselyDb, NewTrip, WheelchairAccessibility } from "@bods-integrated-data/shared/database";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as databaseFunctions from "./database";
import { processTrips } from "./trips";

describe("trips", () => {
    MockDate.set("2024-02-10");

    const dbClient: KyselyDb = vi.fn() as unknown as KyselyDb;
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
                routeId: 11,
                serviceId: 12,
                shapeId: "13",
                tripId: "",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    "@_RevisionNumber": "2",
                    LineRef: "15",
                    ServiceRef: "16",
                    JourneyPatternRef: "17",
                    VehicleJourneyCode: "18",
                    DepartureTime: "00:01:00",
                    DepartureDayShift: 1,
                },
                journeyPattern: {
                    "@_id": "1",
                    JourneyPatternSectionRefs: [],
                },
            },
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    LineRef: "5",
                    ServiceRef: "6",
                    JourneyPatternRef: "7",
                    VehicleJourneyCode: "8",
                    DepartureTime: "23:59:00",
                    Operational: {
                        Block: {
                            BlockNumber: "block1",
                        },
                        TicketMachine: {
                            JourneyCode: "journey1",
                        },
                    },
                    DestinationDisplay: "vjDisplay1",
                    OperatingProfile: {
                        RegularDayType: {
                            DaysOfWeek: {
                                Monday: "",
                            },
                        },
                    },
                },

                journeyPattern: {
                    "@_id": "1",
                    DestinationDisplay: "jpDisplay1",
                    JourneyPatternSectionRefs: [],
                    Direction: "inbound",
                },
            },
        ];

        const expectedTrips: NewTrip[] = [
            {
                id: "VJ28c521ca45f8b29027531375bd76dec15ec90dd5",
                route_id: 1,
                service_id: 2,
                departure_day_shift: false,
                block_id: "",
                shape_id: "3",
                trip_headsign: "vjDisplay1",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "8",
                ticket_machine_journey_code: "journey1",
                file_path: "path/file1",
                direction: "1",
                revision_number: "2",
                departure_time: "23:59:00z",
            },
            {
                id: "VJ668c580888094ff9bad05521b7b82f58e8f31ed0",
                route_id: 11,
                service_id: 12,
                departure_day_shift: true,
                block_id: "",
                shape_id: "13",
                trip_headsign: "",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "18",
                ticket_machine_journey_code: "",
                file_path: "path/file1",
                direction: "",
                revision_number: "2",
                departure_time: "00:01:00z",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient) => Promise.resolve([]));

        const updatedVehicleJourneyMappings = await processTrips(dbClient, vehicleJourneyMappings, "path/file1", "2");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
        expect(updatedVehicleJourneyMappings).toMatchSnapshot();
    });

    it("inserts trips into the database and removes trips with conflicting files from updatedVehicleJourneyMappings", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 11,
                serviceId: 12,
                shapeId: "13",
                tripId: "",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    "@_RevisionNumber": "2",
                    LineRef: "15",
                    ServiceRef: "16",
                    JourneyPatternRef: "17",
                    VehicleJourneyCode: "18",
                    DepartureTime: "00:01:00",
                    DepartureDayShift: 1,
                },
                journeyPattern: {
                    "@_id": "1",
                    JourneyPatternSectionRefs: [],
                },
            },
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    LineRef: "5",
                    ServiceRef: "6",
                    JourneyPatternRef: "7",
                    VehicleJourneyCode: "8",
                    DepartureTime: "23:59:00",
                    Operational: {
                        Block: {
                            BlockNumber: "block1",
                        },
                        TicketMachine: {
                            JourneyCode: "journey1",
                        },
                    },
                    DestinationDisplay: "vjDisplay1",
                    OperatingProfile: {
                        RegularDayType: {
                            DaysOfWeek: {
                                Monday: "",
                            },
                        },
                    },
                },

                journeyPattern: {
                    "@_id": "1",
                    DestinationDisplay: "jpDisplay1",
                    JourneyPatternSectionRefs: [],
                    Direction: "inbound",
                },
            },
        ];

        const expectedTrips: NewTrip[] = [
            {
                id: "VJ28c521ca45f8b29027531375bd76dec15ec90dd5",
                route_id: 1,
                service_id: 2,
                departure_day_shift: false,
                block_id: "",
                shape_id: "3",
                trip_headsign: "vjDisplay1",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "8",
                ticket_machine_journey_code: "journey1",
                file_path: "path/file1",
                direction: "1",
                revision_number: "2",
                departure_time: "23:59:00z",
            },
            {
                id: "VJ668c580888094ff9bad05521b7b82f58e8f31ed0",
                route_id: 11,
                service_id: 12,
                departure_day_shift: true,
                block_id: "",
                shape_id: "13",
                trip_headsign: "",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "18",
                ticket_machine_journey_code: "",
                file_path: "path/file1",
                direction: "",
                revision_number: "2",
                departure_time: "00:01:00z",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient) =>
            Promise.resolve([{ id: "VJ668c580888094ff9bad05521b7b82f58e8f31ed0", conflicting_files: ["path/file1"] }]),
        );

        const updatedVehicleJourneyMappings = await processTrips(dbClient, vehicleJourneyMappings, "path/file1", "2");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
        expect(updatedVehicleJourneyMappings).toMatchSnapshot();
    });

    it("uses the journey pattern destination display when the vehicle journey destination display is omitted", async () => {
        MockDate.set("2024-06-10");

        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "",
                blockId: "",
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
                id: "VJa86d0c4c9a415ad9410c3833141bf70b0e6edee7",
                route_id: 1,
                service_id: 2,
                block_id: "",
                shape_id: "3",
                departure_day_shift: false,
                trip_headsign: "jpDisplay1",
                wheelchair_accessible: WheelchairAccessibility.NoAccessibilityInformation,
                vehicle_journey_code: "8",
                ticket_machine_journey_code: "journey1",
                file_path: "",
                direction: "",
                departure_time: "05:00:00z",
                revision_number: "1",
            },
        ];

        insertTripsMock.mockImplementation((_dbClient) => Promise.resolve([]));

        await processTrips(dbClient, vehicleJourneyMappings, "", "1");

        expect(insertTripsMock).toHaveBeenCalledWith(dbClient, expectedTrips);
    });

    it("doesn't insert trips into the database when the vehicle journey mapping is empty", async () => {
        await processTrips(dbClient, [], "", "1");
        expect(insertTripsMock).not.toHaveBeenCalled();
    });
});
