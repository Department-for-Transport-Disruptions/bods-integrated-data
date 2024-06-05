import { DropOffType, KyselyDb, NewStopTime, PickupType, Timepoint } from "@bods-integrated-data/shared/database";
import { TxcJourneyPatternSection } from "@bods-integrated-data/shared/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as utilFunctions from "../utils";
import * as databaseFunctions from "./database";
import { processStopTimes } from "./stopTimes";

describe("stopTimes", () => {
    let dbClient: KyselyDb;
    const mapTimingLinksToStopTimesMock = vi.spyOn(utilFunctions, "mapTimingLinksToStopTimes");
    const insertStopTimesMock = vi.spyOn(databaseFunctions, "insertStopTimes");
    const updateTripWithOriginAndDestinationRefMock = vi.spyOn(
        databaseFunctions,
        "updateTripWithOriginAndDestinationRef",
    );

    updateTripWithOriginAndDestinationRefMock.mockImplementation(() => Promise.resolve());

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("inserts stop times into the database", async () => {
        const journeyPatternSections: TxcJourneyPatternSection[] = [
            {
                "@_id": "1",
                JourneyPatternTimingLink: [{ "@_id": "1" }],
            },
            {
                "@_id": "2",
                JourneyPatternTimingLink: [{ "@_id": "2," }],
            },
            {
                "@_id": "3",
                JourneyPatternTimingLink: [{ "@_id": "3" }],
            },
        ];

        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "trip1",
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
                    JourneyPatternSectionRefs: ["1", "2"],
                },
            },
            {
                routeId: 11,
                serviceId: 12,
                shapeId: "13",
                tripId: "trip2",
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
                    JourneyPatternSectionRefs: ["3"],
                },
            },
        ];

        const expectedStopTimes: NewStopTime[] = [
            {
                trip_id: "trip1",
                stop_id: "1",
                destination_stop_id: "2",
                arrival_time: "",
                departure_time: "",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Approximate,
            },
            {
                trip_id: "trip2",
                stop_id: "2",
                destination_stop_id: "",
                arrival_time: "",
                departure_time: "",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Approximate,
            },
        ];

        mapTimingLinksToStopTimesMock.mockImplementationOnce(() => [expectedStopTimes[0]]);
        mapTimingLinksToStopTimesMock.mockImplementationOnce(() => [expectedStopTimes[1]]);
        insertStopTimesMock.mockImplementation(() => Promise.resolve());

        await processStopTimes(dbClient, journeyPatternSections, vehicleJourneyMappings);

        expect(mapTimingLinksToStopTimesMock).toHaveBeenNthCalledWith(
            1,
            vehicleJourneyMappings[0].tripId,
            vehicleJourneyMappings[0].vehicleJourney,
            [
                ...journeyPatternSections[0].JourneyPatternTimingLink,
                ...journeyPatternSections[1].JourneyPatternTimingLink,
            ],
        );
        expect(mapTimingLinksToStopTimesMock).toHaveBeenNthCalledWith(
            2,
            vehicleJourneyMappings[1].tripId,
            vehicleJourneyMappings[1].vehicleJourney,
            journeyPatternSections[2].JourneyPatternTimingLink,
        );
        expect(insertStopTimesMock).toHaveBeenCalledWith(dbClient, expectedStopTimes);
    });

    it("inserts origin and destination ref into trip table", async () => {
        const journeyPatternSections: TxcJourneyPatternSection[] = [
            {
                "@_id": "1",
                JourneyPatternTimingLink: [{ "@_id": "1" }],
            },
            {
                "@_id": "2",
                JourneyPatternTimingLink: [{ "@_id": "2," }],
            },
            {
                "@_id": "3",
                JourneyPatternTimingLink: [{ "@_id": "3" }],
            },
        ];

        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "trip1",
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
                    JourneyPatternSectionRefs: ["1", "2"],
                },
            },
            {
                routeId: 11,
                serviceId: 12,
                shapeId: "13",
                tripId: "trip2",
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
                    JourneyPatternSectionRefs: ["3"],
                },
            },
        ];

        const expectedStopTimes: NewStopTime[] = [
            {
                trip_id: "trip1",
                stop_id: "1",
                destination_stop_id: "2",
                arrival_time: "",
                departure_time: "",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Approximate,
            },
            {
                trip_id: "trip1",
                stop_id: "2",
                destination_stop_id: "",
                arrival_time: "",
                departure_time: "",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Approximate,
            },
            {
                trip_id: "trip2",
                stop_id: "2",
                destination_stop_id: "",
                arrival_time: "",
                departure_time: "",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Approximate,
            },
        ];

        mapTimingLinksToStopTimesMock.mockImplementationOnce(() => [expectedStopTimes[0], expectedStopTimes[1]]);
        mapTimingLinksToStopTimesMock.mockImplementationOnce(() => [expectedStopTimes[2]]);
        insertStopTimesMock.mockImplementation(() => Promise.resolve());

        await processStopTimes(dbClient, journeyPatternSections, vehicleJourneyMappings);

        expect(updateTripWithOriginAndDestinationRefMock).toBeCalledTimes(2);
        expect(updateTripWithOriginAndDestinationRefMock.mock.calls[0]).toEqual([undefined, "trip1", "1", "2"]);
        expect(updateTripWithOriginAndDestinationRefMock.mock.calls[1]).toEqual([undefined, "trip2", "2", null]);
    });

    it("doesn't insert stop times that fail to reference a journey pattern section", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "trip1",
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
                    JourneyPatternSectionRefs: ["1", "2"],
                },
            },
            {
                routeId: 11,
                serviceId: 12,
                shapeId: "13",
                tripId: "trip2",
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
                    JourneyPatternSectionRefs: ["3"],
                },
            },
        ];

        mapTimingLinksToStopTimesMock.mockImplementation(() => []);

        await processStopTimes(dbClient, [], vehicleJourneyMappings);

        expect(mapTimingLinksToStopTimesMock).toHaveBeenCalledWith(
            vehicleJourneyMappings[0].tripId,
            vehicleJourneyMappings[0].vehicleJourney,
            [],
        );
        expect(insertStopTimesMock).not.toHaveBeenCalled();
    });

    it("doesn't insert stop times that fail to reference a journey pattern", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "trip1",
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
                tripId: "trip2",
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

        await processStopTimes(dbClient, [], vehicleJourneyMappings);

        expect(mapTimingLinksToStopTimesMock).not.toHaveBeenCalled();
        expect(insertStopTimesMock).not.toHaveBeenCalled();
    });
});
