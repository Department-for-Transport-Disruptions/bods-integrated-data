import { transit_realtime } from "gtfs-realtime-bindings";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ExtendedAvl } from "./types";
import { getOccupancyStatus, mapAvlToGtfsEntity, removeDuplicateAvls } from "./utils";

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
        it("returns a mapped GTFS entity", () => {
            const avl: ExtendedAvl = {
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
                route_id: null,
                trip_id: null,
                geom: null,
                vehicle_name: null,
                monitored: null,
                load: null,
                passenger_count: null,
                odometer: null,
                headway_deviation: null,
                schedule_deviation: null,
                vehicle_state: null,
                next_stop_point_id: null,
                next_stop_point_name: null,
                previous_stop_point_id: null,
                previous_stop_point_name: null,
                origin_name: null,
                destination_name: null,
                vehicle_journey_ref: null,
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
                        routeId: "",
                        tripId: "",
                        startDate: null,
                        startTime: null,
                        scheduleRelationship: null,
                    },
                    timestamp: 0,
                },
            };

            const result = mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with an occupancy status when occupancy data exists", () => {
            const avl: ExtendedAvl = {
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
                route_id: null,
                trip_id: null,
                geom: null,
                vehicle_name: null,
                monitored: null,
                load: null,
                passenger_count: null,
                odometer: null,
                headway_deviation: null,
                schedule_deviation: null,
                vehicle_state: null,
                next_stop_point_id: null,
                next_stop_point_name: null,
                previous_stop_point_id: null,
                previous_stop_point_name: null,
                origin_name: null,
                destination_name: null,
                vehicle_journey_ref: null,
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
                        routeId: "",
                        tripId: "",
                        startDate: null,
                        startTime: null,
                        scheduleRelationship: null,
                    },
                    timestamp: 0,
                },
            };

            const result = mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a bearing when bearing data exists", () => {
            const avl: ExtendedAvl = {
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
                route_id: null,
                trip_id: null,
                geom: null,
                vehicle_name: null,
                monitored: null,
                load: null,
                passenger_count: null,
                odometer: null,
                headway_deviation: null,
                schedule_deviation: null,
                vehicle_state: null,
                next_stop_point_id: null,
                next_stop_point_name: null,
                previous_stop_point_id: null,
                previous_stop_point_name: null,
                origin_name: null,
                destination_name: null,
                vehicle_journey_ref: null,
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
                        routeId: "",
                        tripId: "",
                        startDate: null,
                        startTime: null,
                        scheduleRelationship: null,
                    },
                    timestamp: 0,
                },
            };

            const result = mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a vehicle label when the vehicle ref is a valid UK vehicle registration number", () => {
            const avl: ExtendedAvl = {
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
                route_id: null,
                trip_id: null,
                geom: null,
                vehicle_name: null,
                monitored: null,
                load: null,
                passenger_count: null,
                odometer: null,
                headway_deviation: null,
                schedule_deviation: null,
                vehicle_state: null,
                next_stop_point_id: null,
                next_stop_point_name: null,
                previous_stop_point_id: null,
                previous_stop_point_name: null,
                origin_name: null,
                destination_name: null,
                vehicle_journey_ref: null,
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
                        routeId: "",
                        tripId: "",
                        startDate: null,
                        startTime: null,
                        scheduleRelationship: null,
                    },
                    timestamp: 0,
                },
            };

            const result = mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a route ID if a corresponding route can be found", () => {
            const avl: ExtendedAvl = {
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
                route_id: 4,
                trip_id: null,
                geom: null,
                vehicle_name: null,
                monitored: null,
                load: null,
                passenger_count: null,
                odometer: null,
                headway_deviation: null,
                schedule_deviation: null,
                vehicle_state: null,
                next_stop_point_id: null,
                next_stop_point_name: null,
                previous_stop_point_id: null,
                previous_stop_point_name: null,
                origin_name: null,
                destination_name: null,
                vehicle_journey_ref: null,
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
                        routeId: "4",
                        tripId: "",
                        startDate: null,
                        startTime: null,
                        scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
                    },
                    timestamp: 0,
                },
            };

            const result = mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });

        it("returns a mapped GTFS entity with a trip ID if a corresponding trip can be found", () => {
            const avl: ExtendedAvl = {
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
                route_id: 4,
                trip_id: "5",
                geom: null,
                vehicle_name: null,
                monitored: null,
                load: null,
                passenger_count: null,
                odometer: null,
                headway_deviation: null,
                schedule_deviation: null,
                vehicle_state: null,
                next_stop_point_id: null,
                next_stop_point_name: null,
                previous_stop_point_id: null,
                previous_stop_point_name: null,
                origin_name: null,
                destination_name: null,
                vehicle_journey_ref: null,
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
                        routeId: "4",
                        tripId: "5",
                        startDate: null,
                        startTime: null,
                        scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
                    },
                    timestamp: 0,
                },
            };

            const result = mapAvlToGtfsEntity(avl);
            expect(result).toEqual(expected);
        });
    });

    it("returns a mapped GTFS entity with a start date and start time when departure time data exists", () => {
        const avl: ExtendedAvl = {
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
            route_id: 4,
            trip_id: null,
            geom: null,
            vehicle_name: null,
            monitored: null,
            load: null,
            passenger_count: null,
            odometer: null,
            headway_deviation: null,
            schedule_deviation: null,
            vehicle_state: null,
            next_stop_point_id: null,
            next_stop_point_name: null,
            previous_stop_point_id: null,
            previous_stop_point_name: null,
            origin_name: null,
            destination_name: null,
            vehicle_journey_ref: null,
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
                    routeId: "4",
                    tripId: "",
                    startDate: "20240101",
                    startTime: "09:30:45",
                    scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
                },
                timestamp: 0,
            },
        };

        const result = mapAvlToGtfsEntity(avl);
        expect(result).toEqual(expected);
    });

    describe("removeDuplicateAvls", () => {
        it("removes duplicate AVLs", () => {
            const avls: Partial<ExtendedAvl>[] = [
                {
                    id: 0,
                    line_ref: "1",
                    dated_vehicle_journey_ref: "A",
                },
                {
                    id: 1,
                    line_ref: "2",
                    dated_vehicle_journey_ref: "B",
                },
                {
                    id: 2,
                    line_ref: "2",
                    dated_vehicle_journey_ref: "B",
                },
                {
                    id: 3,
                    line_ref: "2",
                    dated_vehicle_journey_ref: "C",
                },
            ];

            const expectedAvls: Partial<ExtendedAvl>[] = [
                {
                    id: 0,
                    line_ref: "1",
                    dated_vehicle_journey_ref: "A",
                },
                {
                    id: 3,
                    line_ref: "2",
                    dated_vehicle_journey_ref: "C",
                },
            ];

            const result = removeDuplicateAvls(avls as ExtendedAvl[]);
            expect(result).toEqual(expectedAvls);
        });
    });
});
