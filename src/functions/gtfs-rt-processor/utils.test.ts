import { Avl } from "@bods-integrated-data/shared/database";
import { transit_realtime } from "gtfs-realtime-bindings";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getOccupancyStatus, mapAvlToGtfsEntity } from "./utils";

describe("utils", () => {
    const mockBucketName = "mock-bucket";
    const { OccupancyStatus } = transit_realtime.VehiclePosition;

    vi.mock("crypto", () => ({
        randomUUID: () => "mock-uuid",
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("getOccupancyStatus", () => {
        it.each([
            ["full", OccupancyStatus.FULL],
            ["seatsAvailable", OccupancyStatus.MANY_SEATS_AVAILABLE],
            ["standingAvailable", OccupancyStatus.STANDING_ROOM_ONLY],
            ["", OccupancyStatus.MANY_SEATS_AVAILABLE],
        ])("returns the correct occupancy status from the avl occupancy", (input, expected) => {
            const result = getOccupancyStatus(input);
            expect(result).toEqual(expected);
        });
    });

    describe("mapAvlToGtfsEntity", () => {
        it("returns a mapped GTFS entity", async () => {
            const avl: Avl = {
                id: 0,
                bearing: "",
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: "",
                response_time_stamp: "",
                producer_ref: "",
                valid_until_time: "",
                line_ref: "",
                direction_ref: "",
                operator_ref: "",
                data_frame_ref: "",
                dated_vehicle_journey_ref: "",
                published_line_name: "",
                origin_ref: "",
                origin_aimed_departure_time: null,
                destination_ref: "",
                block_ref: "",
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: 0,
                        latitude: 2,
                        longitude: 3,
                    },
                    vehicle: {
                        id: "ABC",
                        label: null,
                    },
                    trip: {
                        startDate: null,
                        startTime: null,
                    },
                    timestamp: 0,
                },
            };

            const result = await mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with an occupancy status when occupancy data exists", async () => {
            const avl: Avl = {
                id: 0,
                bearing: "",
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: "full",
                response_time_stamp: "",
                producer_ref: "",
                valid_until_time: "",
                line_ref: "",
                direction_ref: "",
                operator_ref: "",
                data_frame_ref: "",
                dated_vehicle_journey_ref: "",
                published_line_name: "",
                origin_ref: "",
                origin_aimed_departure_time: null,
                destination_ref: "",
                block_ref: "",
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: OccupancyStatus.FULL,
                    position: {
                        bearing: 0,
                        latitude: 2,
                        longitude: 3,
                    },
                    vehicle: {
                        id: "ABC",
                        label: null,
                    },
                    trip: {
                        startDate: null,
                        startTime: null,
                    },
                    timestamp: 0,
                },
            };

            const result = await mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a bearing when bearing data exists", async () => {
            const avl: Avl = {
                id: 0,
                bearing: "1",
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: "",
                response_time_stamp: "",
                producer_ref: "",
                valid_until_time: "",
                line_ref: "",
                direction_ref: "",
                operator_ref: "",
                data_frame_ref: "",
                dated_vehicle_journey_ref: "",
                published_line_name: "",
                origin_ref: "",
                origin_aimed_departure_time: null,
                destination_ref: "",
                block_ref: "",
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: 1,
                        latitude: 2,
                        longitude: 3,
                    },
                    vehicle: {
                        id: "ABC",
                        label: null,
                    },
                    trip: {
                        startDate: null,
                        startTime: null,
                    },
                    timestamp: 0,
                },
            };

            const result = await mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a start date and start time when departure time data exists", async () => {
            const avl: Avl = {
                id: 0,
                bearing: "1",
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: "",
                response_time_stamp: "",
                producer_ref: "",
                valid_until_time: "",
                line_ref: "",
                direction_ref: "",
                operator_ref: "",
                data_frame_ref: "",
                dated_vehicle_journey_ref: "",
                published_line_name: "",
                origin_ref: "",
                origin_aimed_departure_time: "2024-01-01T09:30:45.000Z",
                destination_ref: "",
                block_ref: "",
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: 1,
                        latitude: 2,
                        longitude: 3,
                    },
                    vehicle: {
                        id: "ABC",
                        label: null,
                    },
                    trip: {
                        startDate: "20240101",
                        startTime: "09:30:45",
                    },
                    timestamp: 0,
                },
            };

            const result = await mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a vehicle label when the vehicle ref is a valid UK vehicle registration number", async () => {
            const avl: Avl = {
                id: 0,
                bearing: "",
                latitude: 2,
                longitude: 3,
                vehicle_ref: "AB12CDE",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: "",
                response_time_stamp: "",
                producer_ref: "",
                valid_until_time: "",
                line_ref: "",
                direction_ref: "",
                operator_ref: "",
                data_frame_ref: "",
                dated_vehicle_journey_ref: "",
                published_line_name: "",
                origin_ref: "",
                origin_aimed_departure_time: null,
                destination_ref: "",
                block_ref: "",
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: 0,
                        latitude: 2,
                        longitude: 3,
                    },
                    vehicle: {
                        id: "AB12CDE",
                        label: "AB12CDE",
                    },
                    trip: {
                        startDate: null,
                        startTime: null,
                    },
                    timestamp: 0,
                },
            };

            const result = await mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });
    });
});
