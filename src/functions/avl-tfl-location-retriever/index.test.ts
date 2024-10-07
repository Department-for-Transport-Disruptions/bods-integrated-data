import { NewAvl } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import axios from "axios";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveTflVehicleLocations } from ".";
import { RealTimeVehicleLocationsApiResponse } from "./types";

describe("avl-tfl-location-retriever", () => {
    const axiosGetMock = vi.spyOn(axios, "get");

    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    beforeEach(() => {
        MockDate.set("2024-05-21T12:53:24.000Z");
    });

    afterEach(() => {
        vi.resetAllMocks();
        MockDate.reset();
    });

    describe("retrieveTflVehicleLocations", () => {
        it.each([
            [0, 0],
            [1, 1],
            [20, 1],
            [21, 2],
            [100, 5],
        ])("chunks the HTTP requests into groups of 20", async (input, expected) => {
            const apiResponse: RealTimeVehicleLocationsApiResponse = {
                lines: [
                    {
                        lineId: "1",
                        vehicles: [
                            {
                                producerRef: "Transport_For_London",
                                vehicleRef: "7534",
                                vehicleName: "BP15OMC",
                                operatorRef: "Go-Ahead",
                                monitored: "true",
                                longitude: 0.096946,
                                latitude: 51.522804,
                                recordedAtTime: "2024-05-21T12:53:24.000Z",
                                bearing: 0,
                                odometer: 659529,
                                vehicleState: 4,
                                nextStopPointId: "490011714E",
                                nextStopPointName: "Rosslyn Hill",
                                previousStopPointId: "490011760D",
                                previousStopPointName: "Royal Free Hospital",
                                lineRef: "251",
                                publishedLineName: "1",
                                directionRef: 1,
                                originName: "Royal Free Hospital",
                                originRef: "490011760D",
                                destinationName: "Canada Water Bus Station",
                                destinationRef: "490004733D",
                                vehicleJourneyRef: "",
                                originAimedDepartureTime: 1234,
                            },
                        ],
                    },
                ],
            };
            axiosGetMock.mockResolvedValue({ data: apiResponse });

            const lineIds = Array<string>(input).fill("");
            const vehicleLocations = await retrieveTflVehicleLocations(lineIds, "");

            expect(axiosGetMock).toHaveBeenCalledTimes(expected);
            expect(vehicleLocations).toHaveLength(expected);
        });

        it("sets the HTTP request headers and URL correctly", async () => {
            axiosGetMock.mockResolvedValue({ data: { lines: [] } });

            await retrieveTflVehicleLocations(["1", "2"], "asdf");

            expect(axiosGetMock).toHaveBeenCalledWith("https://api.tfl.gov.uk/RealTimeVehicleLocation/Lines/1,2", {
                headers: { app_key: "asdf" },
            });
        });

        it("returns a default empty response when a request error occurs", async () => {
            axiosGetMock.mockRejectedValue(new Error());

            const vehicleLocations = await retrieveTflVehicleLocations(["1", "2"], "asdf");

            expect(vehicleLocations).toEqual([]);

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "Error fetching TFL vehicle locations with chunk URL https://api.tfl.gov.uk/RealTimeVehicleLocation/Lines/1,2",
            );
        });

        it("strips invalid characters from certain fields", async () => {
            const apiResponse: RealTimeVehicleLocationsApiResponse = {
                lines: [
                    {
                        lineId: "1",
                        vehicles: [
                            {
                                producerRef: "Transport_For_London",
                                vehicleRef: "7534$",
                                vehicleName: "BP15OMC",
                                operatorRef: "Go-Ahead$",
                                monitored: "true",
                                longitude: 0.096946,
                                latitude: 51.522804,
                                recordedAtTime: "2024-05-21T12:53:24.000Z",
                                bearing: 0,
                                odometer: 659529,
                                vehicleState: 4,
                                nextStopPointId: "490011714E",
                                nextStopPointName: "Rosslyn, Hill$",
                                previousStopPointId: "490011760D",
                                previousStopPointName: "Royal, Free Hospital$",
                                lineRef: "251$",
                                publishedLineName: "1$",
                                directionRef: 1,
                                originName: "Royal, Free Hospital$",
                                originRef: "490011760D$",
                                destinationName: "Canada Water, Bus Station$",
                                destinationRef: "490004733D$",
                                vehicleJourneyRef: "123$",
                                originAimedDepartureTime: 0,
                            },
                        ],
                    },
                ],
            };

            const expectedVehicleActivities: NewAvl[] = [
                {
                    response_time_stamp: "2024-05-21T12:53:24.000Z",
                    valid_until_time: "2024-05-21T12:58:24.000Z",
                    producer_ref: "Transport_For_London",
                    vehicle_ref: "7534",
                    vehicle_name: "BP15OMC",
                    operator_ref: "Go-Ahead",
                    monitored: "true",
                    longitude: 0.096946,
                    latitude: 51.522804,
                    recorded_at_time: "2024-05-21T12:53:24.000Z",
                    bearing: 0,
                    odometer: 659529,
                    vehicle_state: 4,
                    next_stop_point_id: "490011714E",
                    next_stop_point_name: "Rosslyn Hill",
                    previous_stop_point_id: "490011760D",
                    previous_stop_point_name: "Royal Free Hospital",
                    line_ref: "251",
                    published_line_name: "1",
                    direction_ref: "1",
                    origin_name: "Royal Free Hospital",
                    origin_ref: "490011760D",
                    destination_name: "Canada Water Bus Station",
                    destination_ref: "490004733D",
                    vehicle_journey_ref: "123",
                    origin_aimed_departure_time: "2024-05-21T00:00:00.000Z",
                    headway_deviation: undefined,
                    item_id: undefined,
                    load: undefined,
                    passenger_count: undefined,
                    schedule_deviation: undefined,
                },
            ];

            axiosGetMock.mockResolvedValue({ data: apiResponse });
            const vehicleLocations = await retrieveTflVehicleLocations(["1"], "");

            expect(vehicleLocations).toEqual(expectedVehicleActivities);
        });
    });
});
