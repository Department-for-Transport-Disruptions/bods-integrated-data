import { transit_realtime } from "gtfs-realtime-bindings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewAvl } from "../database";
import { MatchingTimetable, createTimetableMatchingLookup, sanitiseTicketMachineJourneyCode } from "./utils";
import { getOccupancyStatus, mapAvlToGtfsEntity } from "./utils";

describe("utils", () => {
    const mockBucketName = "mock-bucket";
    const { OccupancyStatus } = transit_realtime.VehiclePosition;

    vi.mock("node:crypto", () => ({
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
            const avl: NewAvl = {
                id: 0,
                bearing: 0,
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: null,
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
                vehicle_monitoring_ref: null,
                destination_aimed_arrival_time: null,
                ticket_machine_service_code: null,
                journey_code: null,
                vehicle_unique_id: null,
                subscription_id: "",
                item_id: null,
                onward_calls: null,
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
            const avl: NewAvl = {
                id: 0,
                bearing: null,
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
                vehicle_monitoring_ref: null,
                destination_aimed_arrival_time: null,
                ticket_machine_service_code: null,
                journey_code: null,
                vehicle_unique_id: null,
                subscription_id: "",
                item_id: null,
                onward_calls: null,
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: OccupancyStatus.FULL,
                    position: {
                        bearing: null,
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
            const avl: NewAvl = {
                id: 0,
                bearing: 1,
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: null,
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
                vehicle_monitoring_ref: null,
                destination_aimed_arrival_time: null,
                ticket_machine_service_code: null,
                journey_code: null,
                vehicle_unique_id: null,
                subscription_id: "",
                item_id: null,
                onward_calls: null,
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
            const avl: NewAvl = {
                id: 0,
                bearing: null,
                latitude: 2,
                longitude: 3,
                vehicle_ref: "AB12CDE",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: null,
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
                vehicle_monitoring_ref: null,
                destination_aimed_arrival_time: null,
                ticket_machine_service_code: null,
                journey_code: null,
                vehicle_unique_id: null,
                subscription_id: "",
                item_id: null,
                onward_calls: null,
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: null,
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
            const avl: NewAvl = {
                id: 0,
                bearing: null,
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: null,
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
                vehicle_monitoring_ref: null,
                destination_aimed_arrival_time: null,
                ticket_machine_service_code: null,
                journey_code: null,
                vehicle_unique_id: null,
                subscription_id: "",
                item_id: null,
                onward_calls: null,
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: null,
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
            const avl: NewAvl = {
                id: 0,
                bearing: null,
                latitude: 2,
                longitude: 3,
                vehicle_ref: "ABC",
                recorded_at_time: "1970-01-01T00:00:00.000Z",
                occupancy: null,
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
                vehicle_monitoring_ref: null,
                destination_aimed_arrival_time: null,
                ticket_machine_service_code: null,
                journey_code: null,
                vehicle_unique_id: null,
                subscription_id: "",
                item_id: null,
                onward_calls: null,
            };

            const expected: transit_realtime.IFeedEntity = {
                id: "mock-uuid",
                vehicle: {
                    occupancyStatus: null,
                    position: {
                        bearing: null,
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
        const avl: NewAvl = {
            id: 0,
            bearing: 1,
            latitude: 2,
            longitude: 3,
            vehicle_ref: "ABC",
            recorded_at_time: "1970-01-01T00:00:00.000Z",
            occupancy: null,
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
            vehicle_monitoring_ref: null,
            destination_aimed_arrival_time: null,
            ticket_machine_service_code: null,
            journey_code: null,
            vehicle_unique_id: null,
            subscription_id: "",
            item_id: null,
            onward_calls: null,
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

    describe("sanitiseTicketMachineJourneyCode", () => {
        it("removes colons from a string", () => {
            expect(sanitiseTicketMachineJourneyCode("test:string")).toBe("teststring");
        });
    });

    describe("createTimetableMatchingLookup", () => {
        it("creates trip maps for timetable data", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "1",
                    origin_stop_ref: "origin_1",
                    destination_stop_ref: "destination_1",
                    departure_time: "",
                    revision_number: "0",
                },
                {
                    direction: "inbound",
                    noc: "NOC2",
                    route_id: 2,
                    route_short_name: "R2",
                    ticket_machine_journey_code: "tmjc2",
                    trip_id: "2",
                    origin_stop_ref: "origin_2",
                    destination_stop_ref: "destination_2",
                    departure_time: "",
                    revision_number: "1",
                },
                {
                    direction: "inbound",
                    noc: "NOC2",
                    route_id: 3,
                    route_short_name: "R3",
                    ticket_machine_journey_code: "tmjc3",
                    trip_id: "3",
                    origin_stop_ref: "origin_3",
                    destination_stop_ref: "destination_3",
                    departure_time: "2024-06-10T19:00:00+00:00",
                    revision_number: "1",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NOC1_R1_outbound_tmjc1: {
                        revision: 0,
                        route_id: 1,
                        route_key: "NOC1_R1",
                        trip_id: "1",
                        use: true,
                    },
                    NOC2_R2_inbound_tmjc2: {
                        revision: 1,
                        route_id: 2,
                        route_key: "NOC2_R2",
                        trip_id: "2",
                        use: true,
                    },
                    NOC2_R3_inbound_tmjc3: {
                        revision: 1,
                        route_id: 3,
                        route_key: "NOC2_R3",
                        trip_id: "3",
                        use: true,
                    },
                },
                matchedTripsWithDepartureTime: {
                    NOC2_R3_inbound_origin_3_destination_3_060406: {
                        revision: 1,
                        route_id: 3,
                        route_key: "NOC2_R3",
                        trip_id: "3",
                        use: true,
                    },
                },
                matchedTripsWithOriginAndDestination: {
                    NOC1_R1_outbound_tmjc1_origin_1_destination_1: {
                        revision: 0,
                        route_id: 1,
                        route_key: "NOC1_R1",
                        trip_id: "1",
                        use: true,
                    },
                    NOC2_R2_inbound_tmjc2_origin_2_destination_2: {
                        revision: 1,
                        route_id: 2,
                        route_key: "NOC2_R2",
                        trip_id: "2",
                        use: true,
                    },
                    NOC2_R3_inbound_tmjc3_origin_3_destination_3: {
                        revision: 1,
                        route_id: 3,
                        route_key: "NOC2_R3",
                        trip_id: "3",
                        use: true,
                    },
                },
            });
        });

        it("returns match with latest revision if multiple matching trips with revisions", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "1",
                    origin_stop_ref: "origin_1",
                    destination_stop_ref: "destination_1",
                    departure_time: "",
                    revision_number: "0",
                },
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "2",
                    origin_stop_ref: "origin_1",
                    destination_stop_ref: "destination_1",
                    departure_time: "",
                    revision_number: "1",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NOC1_R1_outbound_tmjc1: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NOC1_R1",
                        trip_id: "2",
                        use: true,
                    },
                },
                matchedTripsWithDepartureTime: {},
                matchedTripsWithOriginAndDestination: {
                    NOC1_R1_outbound_tmjc1_origin_1_destination_1: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NOC1_R1",
                        trip_id: "2",
                        use: true,
                    },
                },
            });
        });

        it("returns no match if multiple possible trips and any do not have a revision", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "1",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                    revision_number: "0",
                },
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "2",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                    revision_number: "",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NOC1_R1_outbound_tmjc1: null,
                },
                matchedTripsWithDepartureTime: {},
                matchedTripsWithOriginAndDestination: {},
            });
        });

        it("returns no match if multiple possible trips and 2 share the highest revision number", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "1",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                    revision_number: "0",
                },
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "2",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                    revision_number: "0",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NOC1_R1_outbound_tmjc1: null,
                },
                matchedTripsWithDepartureTime: {},
                matchedTripsWithOriginAndDestination: {},
            });
        });

        it("returns a match if multiple possible trips are found for initial matching attempt but a single match is found with origin/destination checks", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "2",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip3",
                    revision_number: "2",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NCTR_R1_outbound_tmjc1: {
                        revision: 2,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip2",
                        use: false,
                    },
                },
                matchedTripsWithDepartureTime: {},
                matchedTripsWithOriginAndDestination: {
                    NCTR_R1_outbound_tmjc1_abc123_xyz123: {
                        revision: 2,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip2",
                        use: true,
                    },
                },
            });
        });

        it("returns no match if multiple possible trips are found for initial matching attempt and multiple matches found with origin/destination checks", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    origin_stop_ref: "",
                    destination_stop_ref: "",
                    departure_time: "",
                    revision_number: "1",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "",
                    revision_number: "1",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip3",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "",
                    revision_number: "1",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NCTR_R1_outbound_tmjc1: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: false,
                    },
                },
                matchedTripsWithDepartureTime: {},
                matchedTripsWithOriginAndDestination: {
                    NCTR_R1_outbound_tmjc1_abc123_xyz123: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip2",
                        use: false,
                    },
                },
            });
        });

        it("returns a match if multiple possible trips are found for initial matching attempt and multiple matches found with origin/destination checks but one has a higher version", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "5",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "2",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip3",
                    origin_stop_ref: "123abc",
                    destination_stop_ref: "123xyz",
                    departure_time: "",
                    revision_number: "",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NCTR_R1_outbound_tmjc1: null,
                },
                matchedTripsWithDepartureTime: {},
                matchedTripsWithOriginAndDestination: {
                    NCTR_R1_outbound_tmjc1_123abc_123xyz: {
                        revision: 0,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip3",
                        use: true,
                    },
                    NCTR_R1_outbound_tmjc1_abc123_xyz123: {
                        revision: 5,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: true,
                    },
                },
            });
        });

        it("returns match using departure time if no match found with previous checks", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "19:00:00+00",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NCTR_R1_outbound_tmjc1: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: true,
                    },
                },
                matchedTripsWithDepartureTime: {
                    NCTR_R1_outbound_abc123_xyz123_190000: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: true,
                    },
                },
                matchedTripsWithOriginAndDestination: {
                    NCTR_R1_outbound_tmjc1_abc123_xyz123: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: true,
                    },
                },
            });
        });

        it("returns no match if multiple possible trips found using departure time", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "19:00:00+00",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "1",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "19:00:00+00",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NCTR_R1_outbound_tmjc1: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: false,
                    },
                },
                matchedTripsWithDepartureTime: {
                    NCTR_R1_outbound_abc123_xyz123_190000: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: false,
                    },
                },
                matchedTripsWithOriginAndDestination: {
                    NCTR_R1_outbound_tmjc1_abc123_xyz123: {
                        revision: 1,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip",
                        use: false,
                    },
                },
            });
        });

        it("returns match using departure time if multiple possible trips found but one has a higher version number", async () => {
            const timetableData: MatchingTimetable[] = [
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "19:00:00+00",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "2",
                    origin_stop_ref: "abc123",
                    destination_stop_ref: "xyz123",
                    departure_time: "19:00:00+00",
                },
            ];

            const result = createTimetableMatchingLookup(timetableData);

            expect(result).toEqual({
                matchedTrips: {
                    NCTR_R1_outbound_tmjc1: {
                        revision: 2,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip2",
                        use: true,
                    },
                },
                matchedTripsWithDepartureTime: {
                    NCTR_R1_outbound_abc123_xyz123_190000: {
                        revision: 2,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip2",
                        use: true,
                    },
                },
                matchedTripsWithOriginAndDestination: {
                    NCTR_R1_outbound_tmjc1_abc123_xyz123: {
                        revision: 2,
                        route_id: 1,
                        route_key: "NCTR_R1",
                        trip_id: "nctr_trip2",
                        use: true,
                    },
                },
            });
        });
    });
});
