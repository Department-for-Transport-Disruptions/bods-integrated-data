import { logger } from "@baselime/lambda-logger";
import axios from "axios";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveTflVehicleLocations } from ".";
import { RealTimeVehicleLocationsApiResponse } from "./types";

describe("avl-tfl-location-retriever", () => {
    const axiosGetMock = vi.spyOn(axios, "get");

    vi.mock("@baselime/lambda-logger", () => ({
        logger: {
            error: vi.fn(),
        },
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
                "Error fetching TFL vehicle locations with chunk URL https://api.tfl.gov.uk/RealTimeVehicleLocation/Lines/1,2",
                expect.any(Error),
            );
        });
    });
});
