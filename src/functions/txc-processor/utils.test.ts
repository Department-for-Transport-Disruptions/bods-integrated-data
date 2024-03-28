import { logger } from "@baselime/lambda-logger";
import { DropOffType, NewStopTime, PickupType, Timepoint } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { AbstractTimingLink } from "@bods-integrated-data/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirstNonZeroDuration, mapTimingLinkToStopTime } from "./utils";

describe("utils", () => {
    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            warn: vi.fn(),
        },
    }));

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("mapTimingLinkToStopTime", () => {
        it("returns an empty object when no stop point ref is found", () => {
            const currentDepartureTime = getDate("00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                "@_id": "1",
            };

            const result = mapTimingLinkToStopTime(
                "from",
                currentDepartureTime,
                "trip_id",
                0,
                journeyPatternTimingLink,
            );

            expect(result).toEqual({});
            expect(logger.warn).toHaveBeenCalledWith(
                `Missing stop point ref for journey pattern timing link with ref: ${journeyPatternTimingLink["@_id"]}`,
            );
        });

        it("returns a stop time using journey pattern timing link 'From' data when it is defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                RunTime: "PT1M",
                From: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
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

            expect(result.runTime?.asMinutes()).toEqual(1);
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time using vehicle journey timing link 'From' data when journey pattern timing link data is not defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const vehicleJourneyTimingLink: AbstractTimingLink = {
                RunTime: "PT1M",
                To: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
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

            expect(result.runTime?.asMinutes()).toEqual(1);
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time using journey pattern timing link 'To' data when it is defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                RunTime: "PT1M",
                To: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
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

            expect(result.runTime?.asMinutes()).toEqual(1);
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time using vehicle journey timing link 'To' data when journey pattern timing link data is not defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const vehicleJourneyTimingLink: AbstractTimingLink = {
                RunTime: "PT1M",
                From: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                },
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

            expect(result.runTime?.asMinutes()).toEqual(1);
            expect(result.stopTime).toEqual(stopTime);
        });

        it("returns a stop time with a different departure time when wait time data is defined", () => {
            const currentDepartureTime = getDate("01/01/2024 00:00:00");
            const journeyPatternTimingLink: AbstractTimingLink = {
                RunTime: "PT1M",
                From: {
                    StopPointRef: "stop_id",
                    Activity: "pickUpAndSetDown",
                    TimingStatus: "principalTimingPoint",
                    WaitTime: "PT30S",
                },
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

            expect(result.runTime?.asMinutes()).toEqual(1);
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
