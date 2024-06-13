import { transit_realtime } from "gtfs-realtime-bindings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Avl, KyselyDb, NewAvl } from "../database";
import { matchAvlToTimetables, removeDuplicateAvls, sanitiseTicketMachineJourneyCode } from "./utils";
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
                has_onward_calls: false,
                subscription_id: "",
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
                has_onward_calls: false,
                subscription_id: "",
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
                has_onward_calls: false,
                subscription_id: "",
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
                has_onward_calls: false,
                subscription_id: "",
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
                has_onward_calls: false,
                subscription_id: "",
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
                has_onward_calls: false,
                subscription_id: "",
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
            has_onward_calls: false,
            subscription_id: "",
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
            const avls: Partial<NewAvl>[] = [
                {
                    id: 0,
                    trip_id: "1",
                },
                {
                    id: 1,
                    trip_id: "2",
                },
                {
                    id: 2,
                    trip_id: "2",
                },
            ];

            const expectedAvls: Partial<NewAvl>[] = [
                {
                    id: 0,
                    trip_id: "1",
                },
            ];

            const result = removeDuplicateAvls(avls as NewAvl[]);
            expect(result).toEqual(expectedAvls);
        });

        it("ignores AVLs that have missing trip IDs", () => {
            const avls: Partial<NewAvl>[] = [
                {
                    id: 0,
                    trip_id: "",
                },
                {
                    id: 1,
                    trip_id: "",
                },
                {
                    id: 2,
                    trip_id: null,
                },
                {
                    id: 3,
                    trip_id: null,
                },
                {
                    id: 4,
                    trip_id: undefined,
                },
                {
                    id: 5,
                    trip_id: undefined,
                },
            ];

            const result = removeDuplicateAvls(avls as NewAvl[]);
            expect(result).toEqual(avls);
        });
    });

    describe("sanitiseTicketMachineJourneyCode", () => {
        it("removes colons from a string", () => {
            expect(sanitiseTicketMachineJourneyCode("test:string")).toBe("teststring");
        });
    });

    describe("matchAvlToTimetables", () => {
        const mocks = vi.hoisted(() => ({
            executeMock: vi.fn(),
        }));

        let dbClientMock: KyselyDb;

        beforeEach(() => {
            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NOC1",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "1",
                },
                {
                    direction: "inbound",
                    noc: "NOC2",
                    route_id: 2,
                    route_short_name: "R2",
                    ticket_machine_journey_code: "tmjc2",
                    trip_id: "2",
                },
            ]);

            dbClientMock = {
                selectFrom: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                innerJoin: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                execute: mocks.executeMock,
            } as unknown as KyselyDb;
        });

        it("correctly matches AVL data to timetable data", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NOC1",
                    line_ref: "R1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
                {
                    operator_ref: "NOC2",
                    line_ref: "R2",
                    dated_vehicle_journey_ref: "tmjc2",
                    direction_ref: "inbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "1",
                    },
                    {
                        ...avl[1],
                        geom: {},
                        route_id: 2,
                        trip_id: "2",
                    },
                ],
                matchedAvlCount: 2,
                totalAvlCount: 2,
            });
        });

        it("correctly matches AVL data with a NOC in the operatorNocMap to timetable data", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "nctr_trip",
                    },
                ],
                matchedAvlCount: 1,
                totalAvlCount: 1,
            });
        });

        it("does not set route_id when matching route found but no matching trip", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NOC1",
                    line_ref: "R1",
                    dated_vehicle_journey_ref: "invalid",
                    direction_ref: "1",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns no matching data if no matching route found", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NOC1",
                    line_ref: "R2",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns no match if multiple possible trip ids are found for a single location", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns match with latest revision if multiple matching trips with revisions", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "2",
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "nctr_trip2",
                    },
                ],
                matchedAvlCount: 1,
                totalAvlCount: 1,
            });
        });

        it("returns no match if multiple possible trips and any do not have a revision", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "2",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip3",
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns no match if multiple possible trips and 2 share the highest revision number", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip2",
                    revision_number: "2",
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip3",
                    revision_number: "2",
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns a match if multiple possible trips are found for initial matching attempt but a single match is found with origin/destination checks", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                    origin_ref: "abc123",
                    destination_ref: "xyz123",
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
                    revision_number: "1",
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
                },
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip3",
                    revision_number: "2",
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "nctr_trip2",
                    },
                ],
                matchedAvlCount: 1,
                totalAvlCount: 1,
            });
        });

        it("returns no match if multiple possible trips are found for initial matching attempt and multiple matches found with origin/destination checks", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                    origin_ref: "abc123",
                    destination_ref: "xyz123",
                },
            ];

            mocks.executeMock.mockResolvedValue([
                {
                    direction: "outbound",
                    noc: "NCTR",
                    route_id: 1,
                    route_short_name: "R1",
                    ticket_machine_journey_code: "tmjc1",
                    trip_id: "nctr_trip",
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
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns a match if multiple possible trips are found for initial matching attempt and multiple matches found with origin/destination checks but one has a higher version", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: "tmjc1",
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                    origin_ref: "abc123",
                    destination_ref: "xyz123",
                },
            ];

            mocks.executeMock.mockResolvedValue([
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
                },
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "nctr_trip",
                    },
                ],
                matchedAvlCount: 1,
                totalAvlCount: 1,
            });
        });

        it("returns match using departure time if no match found with previous checks", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: null,
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                    origin_aimed_departure_time: "2024-06-10T19:00:00+00:00",
                    origin_ref: "abc123",
                    destination_ref: "xyz123",
                },
            ];

            mocks.executeMock.mockResolvedValue([
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
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "nctr_trip",
                    },
                ],
                matchedAvlCount: 1,
                totalAvlCount: 1,
            });
        });

        it("returns no match if multiple possible trips found using departure time", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: null,
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                    origin_aimed_departure_time: "2024-06-10T19:00:00+00:00",
                    origin_ref: "abc123",
                    destination_ref: "xyz123",
                },
            ];

            mocks.executeMock.mockResolvedValue([
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
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: undefined,
                        trip_id: undefined,
                    },
                ],
                matchedAvlCount: 0,
                totalAvlCount: 1,
            });
        });

        it("returns match using departure time if multiple possible trips found but one has a higher version number", async () => {
            const avl: Partial<NewAvl>[] = [
                {
                    operator_ref: "NT",
                    line_ref: "NTR1",
                    dated_vehicle_journey_ref: null,
                    direction_ref: "outbound",
                    longitude: -1.123,
                    latitude: 51.123,
                    origin_aimed_departure_time: "2024-06-10T19:00:00+00:00",
                    origin_ref: "abc123",
                    destination_ref: "xyz123",
                },
            ];

            mocks.executeMock.mockResolvedValue([
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
            ]);

            const matchedAvl = await matchAvlToTimetables(dbClientMock, avl as NewAvl[]);

            expect(matchedAvl).toEqual({
                avls: [
                    {
                        ...avl[0],
                        geom: {},
                        route_id: 1,
                        trip_id: "nctr_trip2",
                    },
                ],
                matchedAvlCount: 1,
                totalAvlCount: 1,
            });
        });
    });
});
