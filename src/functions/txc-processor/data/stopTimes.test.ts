import {
    DropOffType,
    KyselyDb,
    LocationType,
    NewStopTime,
    PickupType,
    Timepoint,
} from "@bods-integrated-data/shared/database";
import { TxcJourneyPatternSection } from "@bods-integrated-data/shared/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as databaseFunctions from "./database";
import { processStopTimes } from "./stopTimes";

describe("stopTimes", () => {
    const dbClient = vi.fn() as unknown as KyselyDb;
    const insertStopTimesMock = vi.spyOn(databaseFunctions, "insertStopTimes");
    const updateTripWithOriginAndDestinationRefMock = vi.spyOn(
        databaseFunctions,
        "updateTripWithOriginAndDestinationRef",
    );

    updateTripWithOriginAndDestinationRefMock.mockImplementation(() => Promise.resolve());

    beforeEach(() => {
        vi.resetAllMocks();
    });

    const defaultInsertedStops = [
        {
            id: "1",
            location_type: LocationType.StopOrPlatform,
            wheelchair_boarding: 0,
        },
        {
            id: "2",
            location_type: LocationType.StopOrPlatform,
            wheelchair_boarding: 0,
        },
        {
            id: "3",
            location_type: LocationType.StopOrPlatform,
            wheelchair_boarding: 0,
        },
        {
            id: "A",
            location_type: LocationType.StopOrPlatform,
            wheelchair_boarding: 0,
        },
        {
            id: "B",
            location_type: LocationType.StopOrPlatform,
            wheelchair_boarding: 0,
        },
    ];

    it("inserts stop times into the database", async () => {
        const journeyPatternSections: TxcJourneyPatternSection[] = [
            {
                "@_id": "1",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "1",
                        From: {
                            StopPointRef: "1",
                            Activity: "pickUp",
                        },
                        To: {
                            StopPointRef: "2",
                        },
                        RunTime: "PT2M",
                    },
                ],
            },
            {
                "@_id": "2",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "2,",
                        From: {
                            StopPointRef: "2",
                            WaitTime: "PT1M",
                            Activity: "pickUpAndSetDown",
                        },
                        To: {
                            StopPointRef: "3",
                            Activity: "setDown",
                        },
                        RunTime: "PT5M",
                    },
                ],
            },
            {
                "@_id": "3",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "3",
                        From: {
                            StopPointRef: "a",
                            Activity: "pickUp",
                        },
                        To: {
                            StopPointRef: "b",
                            Activity: "setDown",
                        },
                        RunTime: "PT12M",
                    },
                ],
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
                arrival_time: "00:00:00",
                departure_time: "00:00:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.NoDropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip1",
                stop_id: "2",
                destination_stop_id: "3",
                arrival_time: "00:02:00",
                departure_time: "00:03:00",
                stop_sequence: 1,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip1",
                stop_id: "3",
                destination_stop_id: "",
                arrival_time: "00:08:00",
                departure_time: "00:08:00",
                stop_sequence: 2,
                stop_headsign: "",
                pickup_type: PickupType.NoPickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip2",
                stop_id: "A",
                destination_stop_id: "B",
                arrival_time: "00:01:00",
                departure_time: "00:01:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.NoDropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip2",
                stop_id: "B",
                destination_stop_id: "",
                arrival_time: "00:13:00",
                departure_time: "00:13:00",
                stop_sequence: 1,
                stop_headsign: "",
                pickup_type: PickupType.NoPickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
        ];

        insertStopTimesMock.mockImplementation(() => Promise.resolve());

        await processStopTimes(dbClient, journeyPatternSections, vehicleJourneyMappings, defaultInsertedStops);

        expect(insertStopTimesMock).toHaveBeenCalledWith(dbClient, expectedStopTimes);
    });

    it("handles rollover for inserted stop times", async () => {
        const journeyPatternSections: TxcJourneyPatternSection[] = [
            {
                "@_id": "1",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "1",
                        From: {
                            StopPointRef: "1",
                            Activity: "pickUp",
                        },
                        To: {
                            StopPointRef: "2",
                            Activity: "setDown",
                        },
                        RunTime: "PT2M",
                    },
                ],
            },
            {
                "@_id": "2",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "1",
                        From: {
                            StopPointRef: "a",
                            Activity: "pickUp",
                            WaitTime: "PT10M",
                        },
                        To: {
                            StopPointRef: "b",
                            Activity: "setDown",
                        },
                        RunTime: "PT2M",
                    },
                ],
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
                    DepartureTime: "23:59:00",
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
                    JourneyPatternSectionRefs: ["1"],
                },
            },
            {
                routeId: 2,
                serviceId: 200,
                shapeId: "31",
                tripId: "trip2",
                serviceCode: "test2",
                vehicleJourney: {
                    LineRef: "51",
                    ServiceRef: "61",
                    JourneyPatternRef: "9",
                    VehicleJourneyCode: "8",
                    DepartureTime: "23:59:00",
                    Operational: {
                        Block: {
                            BlockNumber: "block2",
                        },
                        TicketMachine: {
                            JourneyCode: "journey2",
                        },
                    },
                },
                journeyPattern: {
                    "@_id": "9",
                    DestinationDisplay: "service2",
                    JourneyPatternSectionRefs: ["2"],
                },
            },
        ];

        const expectedStopTimes: NewStopTime[] = [
            {
                trip_id: "trip1",
                stop_id: "1",
                destination_stop_id: "2",
                arrival_time: "23:59:00",
                departure_time: "23:59:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.NoDropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip1",
                stop_id: "2",
                destination_stop_id: "",
                arrival_time: "24:01:00",
                departure_time: "24:01:00",
                stop_sequence: 1,
                stop_headsign: "",
                pickup_type: PickupType.NoPickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip2",
                stop_id: "A",
                destination_stop_id: "B",
                arrival_time: "23:59:00",
                departure_time: "24:09:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.NoDropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip2",
                stop_id: "B",
                destination_stop_id: "",
                arrival_time: "24:11:00",
                departure_time: "24:11:00",
                stop_sequence: 1,
                stop_headsign: "",
                pickup_type: PickupType.NoPickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
        ];

        insertStopTimesMock.mockImplementation(() => Promise.resolve());

        await processStopTimes(dbClient, journeyPatternSections, vehicleJourneyMappings, defaultInsertedStops);

        expect(insertStopTimesMock).toHaveBeenCalledWith(dbClient, expectedStopTimes);
    });

    it("inserts origin and destination ref into trip table", async () => {
        const journeyPatternSections: TxcJourneyPatternSection[] = [
            {
                "@_id": "1",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "1",
                        From: {
                            StopPointRef: "1",
                            Activity: "pickUp",
                        },
                        To: {
                            StopPointRef: "2",
                        },
                        RunTime: "PT2M",
                    },
                ],
            },
            {
                "@_id": "2",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "2,",
                        From: {
                            StopPointRef: "2",
                            WaitTime: "PT1M",
                            Activity: "pickUpAndSetDown",
                        },
                        To: {
                            StopPointRef: "3",
                            Activity: "setDown",
                        },
                        RunTime: "PT5M",
                    },
                ],
            },
            {
                "@_id": "3",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "3",
                        From: {
                            StopPointRef: "a",
                            Activity: "pickUp",
                        },
                        To: {
                            StopPointRef: "b",
                            Activity: "setDown",
                        },
                        RunTime: "PT12M",
                    },
                ],
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

        insertStopTimesMock.mockImplementation(() => Promise.resolve());

        await processStopTimes(dbClient, journeyPatternSections, vehicleJourneyMappings, defaultInsertedStops);

        expect(updateTripWithOriginAndDestinationRefMock).toBeCalledTimes(2);
        expect(updateTripWithOriginAndDestinationRefMock.mock.calls[0]).toEqual([dbClient, "trip1", "1", "3"]);
        expect(updateTripWithOriginAndDestinationRefMock.mock.calls[1]).toEqual([dbClient, "trip2", "A", "B"]);
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

        await processStopTimes(dbClient, [], vehicleJourneyMappings, defaultInsertedStops);

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

        await processStopTimes(dbClient, [], vehicleJourneyMappings, defaultInsertedStops);

        expect(insertStopTimesMock).not.toHaveBeenCalled();
    });

    it("excludes stop times with location type of 2, 3 or 4", async () => {
        const journeyPatternSections: TxcJourneyPatternSection[] = [
            {
                "@_id": "1",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "1",
                        From: {
                            StopPointRef: "1",
                            Activity: "pickUp",
                        },
                        To: {
                            StopPointRef: "2",
                        },
                        RunTime: "PT2M",
                    },
                ],
            },
            {
                "@_id": "2",
                JourneyPatternTimingLink: [
                    {
                        "@_id": "2,",
                        From: {
                            StopPointRef: "2",
                            WaitTime: "PT1M",
                            Activity: "pickUpAndSetDown",
                        },
                        To: {
                            StopPointRef: "3",
                            Activity: "setDown",
                        },
                        RunTime: "PT5M",
                    },
                ],
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
        ];

        const expectedStopTimes: NewStopTime[] = [
            {
                trip_id: "trip1",
                stop_id: "1",
                destination_stop_id: "2",
                arrival_time: "00:00:00",
                departure_time: "00:00:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.NoDropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
            {
                trip_id: "trip1",
                stop_id: "2",
                destination_stop_id: "3",
                arrival_time: "00:02:00",
                departure_time: "00:03:00",
                stop_sequence: 1,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: true,
            },
            {
                trip_id: "trip1",
                stop_id: "3",
                destination_stop_id: "",
                arrival_time: "00:08:00",
                departure_time: "00:08:00",
                stop_sequence: 2,
                stop_headsign: "",
                pickup_type: PickupType.NoPickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: null,
                timepoint: Timepoint.Approximate,
                exclude: false,
            },
        ];

        insertStopTimesMock.mockImplementation(() => Promise.resolve());

        await processStopTimes(dbClient, journeyPatternSections, vehicleJourneyMappings, [
            {
                id: "1",
                location_type: LocationType.StopOrPlatform,
                wheelchair_boarding: 0,
            },
            {
                id: "2",
                location_type: LocationType.EntranceOrExit,
                wheelchair_boarding: 0,
            },
            {
                id: "3",
                location_type: LocationType.StopOrPlatform,
                wheelchair_boarding: 0,
            },
            {
                id: "4",
                location_type: LocationType.GenericNode,
                wheelchair_boarding: 0,
            },
            {
                id: "5",
                location_type: LocationType.BoardingArea,
                wheelchair_boarding: 0,
            },
        ]);

        expect(insertStopTimesMock).toHaveBeenCalledWith(dbClient, expectedStopTimes);
    });
});
