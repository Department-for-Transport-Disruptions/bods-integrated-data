import { DropOffType, NewStopTime, PickupType, Timepoint } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { AbstractTimingLink, VehicleJourney } from "@bods-integrated-data/shared/schema";
import { describe, expect, it } from "vitest";
import {
    getDropOffTypeFromStopActivity,
    getFirstNonZeroDuration,
    getPickupTypeFromStopActivity,
    getTimepointFromTimingStatus,
    mapTimingLinkToStopTime,
    mapTimingLinksToStopTimes,
} from "./utils";

describe("utils", () => {
    describe("getPickupTypeFromStopActivity", () => {
        it.each([
            ["pickUp", PickupType.Pickup],
            ["pickUpAndSetDown", PickupType.Pickup],
            ["setDown", PickupType.NoPickup],
            ["pass", PickupType.NoPickup],
            [undefined, PickupType.Pickup],
        ])("returns the correct pickup type for the activity", (input, expected) => {
            const result = getPickupTypeFromStopActivity(input);
            expect(result).toEqual(expected);
        });
    });

    describe("getDropOffTypeFromStopActivity", () => {
        it.each([
            ["pickUp", DropOffType.NoDropOff],
            ["pickUpAndSetDown", DropOffType.DropOff],
            ["setDown", DropOffType.DropOff],
            ["pass", DropOffType.NoDropOff],
            [undefined, DropOffType.DropOff],
        ])("returns the correct drop off type for the activity", (input, expected) => {
            const result = getDropOffTypeFromStopActivity(input);
            expect(result).toEqual(expected);
        });
    });

    describe("getTimepointFromTimingStatus", () => {
        it.each([
            ["principalTimingPoint", Timepoint.Exact],
            ["someOtherValue", Timepoint.Approximate],
            [undefined, Timepoint.Approximate],
        ])("returns the correct time point for the timing status", (input, expected) => {
            const result = getTimepointFromTimingStatus(input);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTimingLinksToStopTimes", () => {
        it("throws an error when the departure time cannot be parsed", () => {
            const vehicleJourney: VehicleJourney = {
                DepartureTime: "",
                JourneyPatternRef: "",
                LineRef: "",
                ServiceRef: "",
                VehicleJourneyCode: "1",
            };

            expect(() => mapTimingLinksToStopTimes("trip_id", vehicleJourney, [])).toThrowError(
                `Invalid departure time in vehicle journey with code: ${vehicleJourney.VehicleJourneyCode}`,
            );
        });

        it("returns an empty array when there are no timing links", () => {
            const vehicleJourney: VehicleJourney = {
                DepartureTime: "00:00:00",
                JourneyPatternRef: "",
                LineRef: "",
                ServiceRef: "",
                VehicleJourneyCode: "1",
            };

            const result = mapTimingLinksToStopTimes("trip_id", vehicleJourney, []);
            expect(result).toHaveLength(0);
        });

        it("returns mapped stop times when there is at least one timing link", () => {
            const vehicleJourney: VehicleJourney = {
                DepartureTime: "00:00:00",
                JourneyPatternRef: "",
                LineRef: "",
                ServiceRef: "",
                VehicleJourneyCode: "1",
                VehicleJourneyTimingLink: [
                    {
                        JourneyPatternTimingLinkRef: "1",
                    },
                ],
            };

            const journeyPatternTimingLinks: AbstractTimingLink[] = [
                {
                    "@_id": "1",
                    From: {
                        StopPointRef: "1",
                        Activity: "pickUp",
                        TimingStatus: "principalTimingPoint",
                    },
                    To: {
                        StopPointRef: "2",
                        WaitTime: "PT15S",
                    },
                    RunTime: "PT1M",
                },
                {
                    "@_id": "2",
                    From: {
                        StopPointRef: "2",
                        Activity: "pickUpAndSetDown",
                        TimingStatus: "principalTimingPoint",
                        WaitTime: "PT30S",
                    },
                    To: {
                        StopPointRef: "3",
                        WaitTime: "PT10S",
                    },
                    RunTime: "PT5M",
                },
                {
                    "@_id": "3",
                    From: {
                        StopPointRef: "3",
                        Activity: "pickUpAndSetDown",
                        TimingStatus: "timeInfoPoint",
                        WaitTime: "PT2M",
                    },
                    To: {
                        StopPointRef: "4",
                        Activity: "setDown",
                        TimingStatus: "timeInfoPoint",
                    },
                    RunTime: "PT10M",
                },
            ];

            const expected: NewStopTime[] = [
                {
                    trip_id: "trip_id",
                    stop_id: "1",
                    arrival_time: "00:00:00",
                    departure_time: "00:00:15",
                    stop_sequence: 0,
                    stop_headsign: "",
                    pickup_type: PickupType.Pickup,
                    drop_off_type: DropOffType.NoDropOff,
                    shape_dist_traveled: 0,
                    timepoint: Timepoint.Exact,
                },
                {
                    trip_id: "trip_id",
                    stop_id: "2",
                    arrival_time: "00:01:15",
                    departure_time: "00:01:55",
                    stop_sequence: 1,
                    stop_headsign: "",
                    pickup_type: PickupType.Pickup,
                    drop_off_type: DropOffType.DropOff,
                    shape_dist_traveled: 0,
                    timepoint: Timepoint.Exact,
                },
                {
                    trip_id: "trip_id",
                    stop_id: "3",
                    arrival_time: "00:06:55",
                    departure_time: "00:08:55",
                    stop_sequence: 2,
                    stop_headsign: "",
                    pickup_type: PickupType.Pickup,
                    drop_off_type: DropOffType.DropOff,
                    shape_dist_traveled: 0,
                    timepoint: Timepoint.Approximate,
                },
                {
                    trip_id: "trip_id",
                    stop_id: "4",
                    arrival_time: "00:18:55",
                    departure_time: "00:18:55",
                    stop_sequence: 3,
                    stop_headsign: "",
                    pickup_type: PickupType.NoPickup,
                    drop_off_type: DropOffType.DropOff,
                    shape_dist_traveled: 0,
                    timepoint: Timepoint.Approximate,
                },
            ];

            const result = mapTimingLinksToStopTimes("trip_id", vehicleJourney, journeyPatternTimingLinks);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTimingLinkToStopTime", () => {
        it("throws an error when no stop point ref is found", () => {
            const currentDepartureTime = getDate("00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                "@_id": "1",
            };

            expect(() =>
                mapTimingLinkToStopTime("from", currentDepartureTime, "trip_id", 0, journeyPatternTimingLink),
            ).toThrowError(
                `Missing stop point ref for journey pattern timing link with ref: ${journeyPatternTimingLink["@_id"]}`,
            );
        });

        it("returns a stop time using journey pattern timing link 'From' data when it is defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                From: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
                RunTime: "PT1M",
            };

            const stopTime: NewStopTime = {
                trip_id: "trip_id",
                stop_id: "stop_id",
                arrival_time: "00:00:00",
                departure_time: "00:00:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Exact,
            };

            const result = mapTimingLinkToStopTime(
                "from",
                currentDepartureTime,
                "trip_id",
                0,
                journeyPatternTimingLink,
            );

            expect(result.nextArrivalTime.format("HH:mm:ss")).toEqual("00:01:00");
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time using vehicle journey timing link 'From' data when journey pattern timing link data is not defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const vehicleJourneyTimingLink: AbstractTimingLink = {
                To: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
                RunTime: "PT1M",
            };

            const stopTime: NewStopTime = {
                trip_id: "trip_id",
                stop_id: "stop_id",
                arrival_time: "00:00:00",
                departure_time: "00:00:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Exact,
            };

            const result = mapTimingLinkToStopTime(
                "to",
                currentDepartureTime,
                "trip_id",
                0,
                {},
                vehicleJourneyTimingLink,
            );

            expect(result.nextArrivalTime.format("HH:mm:ss")).toEqual("00:01:00");
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time using journey pattern timing link 'To' data when it is defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                To: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
                RunTime: "PT1M",
            };

            const stopTime: NewStopTime = {
                trip_id: "trip_id",
                stop_id: "stop_id",
                arrival_time: "00:00:00",
                departure_time: "00:00:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Exact,
            };

            const result = mapTimingLinkToStopTime("to", currentDepartureTime, "trip_id", 0, journeyPatternTimingLink);

            expect(result.nextArrivalTime.format("HH:mm:ss")).toEqual("00:01:00");
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time using vehicle journey timing link 'To' data when journey pattern timing link data is not defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const vehicleJourneyTimingLink: AbstractTimingLink = {
                From: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
                RunTime: "PT1M",
            };

            const stopTime: NewStopTime = {
                trip_id: "trip_id",
                stop_id: "stop_id",
                arrival_time: "00:00:00",
                departure_time: "00:00:00",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Exact,
            };

            const result = mapTimingLinkToStopTime(
                "from",
                currentDepartureTime,
                "trip_id",
                0,
                {},
                vehicleJourneyTimingLink,
            );

            expect(result.nextArrivalTime.format("HH:mm:ss")).toEqual("00:01:00");
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time with a different departure time when wait time data is defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                From: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                    WaitTime: "PT30S",
                },
                RunTime: "PT1M",
            };

            const stopTime: NewStopTime = {
                trip_id: "trip_id",
                stop_id: "stop_id",
                arrival_time: "00:00:00",
                departure_time: "00:00:30",
                stop_sequence: 0,
                stop_headsign: "",
                pickup_type: PickupType.Pickup,
                drop_off_type: DropOffType.DropOff,
                shape_dist_traveled: 0,
                timepoint: Timepoint.Exact,
            };

            const result = mapTimingLinkToStopTime(
                "from",
                currentDepartureTime,
                "trip_id",
                0,
                journeyPatternTimingLink,
            );

            expect(result.nextArrivalTime.format("HH:mm:ss")).toEqual("00:01:30");
            expect(result.stopTime).toEqual(stopTime);
        });
    });

    describe("getFirstNonZeroDuration", () => {
        it("returns undefined when there are no durations", () => {
            const result = getFirstNonZeroDuration([]);
            expect(result).toBeUndefined();
        });

        it("returns undefined when all durations are zero", () => {
            const result = getFirstNonZeroDuration(["PT0S", "PT0M", "PT0H"]);
            expect(result).toBeUndefined();
        });

        it.each([
            [["PT1S", "PT0M", "PT0H"], "PT1S"],
            [["PT0S", "PT1M", "PT0H"], "PT1M"],
            [["PT0S", "PT0M", "PT1H"], "PT1H"],
        ])("returns the non-zero duration when at least one exists", (input, expected) => {
            const result = getFirstNonZeroDuration(input);
            expect(result?.toISOString()).toEqual(expected);
        });
    });
});
