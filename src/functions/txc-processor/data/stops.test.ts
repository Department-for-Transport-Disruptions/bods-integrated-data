import {
    KyselyDb,
    LocationType,
    NaptanStop,
    NaptanStopArea,
    NewStop,
    WheelchairAccessibility,
} from "@bods-integrated-data/shared/database";
import { StopPointLocation, TxcAnnotatedStopPointRef, TxcStopPoint } from "@bods-integrated-data/shared/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import {
    NaptanStopWithRegionCode,
    createStopAreaStop,
    getCoordinates,
    mapStop,
    processAnnotatedStopPointRefs,
    processStopPoints,
    sanitiseIndicator,
} from "./stops";

describe("stops", () => {
    const dbClient = vi.fn() as unknown as KyselyDb;
    const getNaptanStopsMock = vi.spyOn(databaseFunctions, "getNaptanStops");
    const getNaptanStopAreasMock = vi.spyOn(databaseFunctions, "getNaptanStopAreas");
    const insertStopsMock = vi.spyOn(databaseFunctions, "insertStops");
    const mockStopAreas: Record<string, NaptanStopArea> = {};

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe("mapStop", () => {
        it("maps a stop using naptan data when it exists", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "BCS",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses the fallback name when it doesn't exist in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                stop_type: "BCS",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: "4",
                    stop_name: "name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses the fallback coordinates when they doesn't exist in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "BCS",
                indicator: "1",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 2,
                    stop_lon: 3,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: "1",
                    region_code: null,
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses a null platform_code when the stop_type doesn't exist in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses a null platform_code when the stop_type doesn't match a known platform code", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "unknown",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("maps a stop using fallback data when no naptan stop exists", () => {
            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name",
                    stop_lat: 2,
                    stop_lon: 3,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3);
            expect(result).toEqual(expected);
        });

        it("maps a stop using region_code if present", () => {
            const naptanStop: Partial<NaptanStopWithRegionCode> = {
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "BCS",
                latitude: "5",
                longitude: "6",
                region_code: "Y",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: "Y",
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("maps a platform stop area to a stop when a matching stop area is found for a stop", () => {
            const mockStopAreas: Record<string, NaptanStopArea> = {
                "111": {
                    stop_area_code: "111",
                    name: "stop_area_1",
                    administrative_area_code: "a1",
                    stop_area_type: "sa1",
                    grid_type: null,
                    easting: null,
                    northing: null,
                    longitude: "123",
                    latitude: "456",
                },
            };

            const naptanStop: Partial<NaptanStopWithRegionCode> = {
                atco_code: "123",
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "BCS",
                latitude: "5",
                longitude: "6",
                region_code: "Y",
                stop_area_code: "111",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: "111",
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: "Y",
                },
                {
                    id: "111",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: null,
                    stop_name: "stop_area_1",
                    stop_lat: 456,
                    stop_lon: 123,
                    location_type: LocationType.Station,
                    platform_code: null,
                    region_code: "Y",
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("maps a real station entrance stop area to a stop when a matching stop area is found for a stop", () => {
            const mockStopAreas: Record<string, NaptanStopArea> = {
                "111": {
                    stop_area_code: "111",
                    name: "stop_area_1",
                    administrative_area_code: "a1",
                    stop_area_type: "sa1",
                    grid_type: null,
                    easting: null,
                    northing: null,
                    longitude: "123",
                    latitude: "456",
                },
            };

            const naptanStop: Partial<NaptanStopWithRegionCode> = {
                atco_code: "123",
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "BCE",
                latitude: "5",
                longitude: "6",
                region_code: "Y",
                stop_area_code: "111",
            };

            const expected: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: "111",
                    stop_code: "4",
                    stop_name: "naptan_name",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: "Y",
                },
                {
                    id: "111",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_code: null,
                    stop_name: "stop_area_1",
                    stop_lat: 456,
                    stop_lon: 123,
                    location_type: LocationType.EntranceOrExit,
                    platform_code: null,
                    region_code: "Y",
                },
            ];

            const result = mapStop(mockStopAreas, "1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });
    });

    describe("processStopPoints", () => {
        it("inserts stops into the database and returns them", async () => {
            const stops: TxcStopPoint[] = [
                {
                    AtcoCode: "1",
                    Descriptor: {
                        CommonName: "name1",
                    },
                    Place: {
                        Location: {
                            Latitude: 1,
                            Longitude: 2,
                        },
                    },
                },
                {
                    AtcoCode: "2",
                    Descriptor: {
                        CommonName: "name2",
                    },
                    Place: {
                        Location: {
                            Latitude: 3,
                            Longitude: 4,
                        },
                    },
                },
            ];

            const expectedStops: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name1",
                    stop_lat: 1,
                    stop_lon: 2,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
                {
                    id: "2",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name2",
                    stop_lat: 3,
                    stop_lon: 4,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            getNaptanStopAreasMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            const result = await processStopPoints(dbClient, stops, false, []);
            expect(insertStopsMock).toHaveBeenCalledWith(dbClient, expectedStops);
            expect(result).toBeTruthy();
        });

        it("inserts coordinates uses easting and northing if no longitude and latitude", async () => {
            const stops: TxcStopPoint[] = [
                {
                    AtcoCode: "1",
                    Descriptor: {
                        CommonName: "name1",
                    },
                    Place: {
                        Location: {
                            Easting: "535053",
                            Northing: "182711",
                        },
                    },
                },
                {
                    AtcoCode: "2",
                    Descriptor: {
                        CommonName: "name2",
                    },
                    Place: {
                        Location: {
                            Easting: "528507",
                            Northing: "181113",
                        },
                    },
                },
            ];

            const expectedStops: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name1",
                    stop_lat: 51.527168897029235,
                    stop_lon: -0.05455691862311166,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
                {
                    id: "2",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name2",
                    stop_lat: 51.514334456018496,
                    stop_lon: -0.14944772395499886,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            getNaptanStopAreasMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            const result = await processStopPoints(dbClient, stops, false, []);
            expect(insertStopsMock).toHaveBeenCalledWith(dbClient, expectedStops);
            expect(result).toBeTruthy();
        });

        it("doesn't return false if any stops without lon/lat that are not in the journey patterns", async () => {
            const stops: TxcStopPoint[] = [
                {
                    AtcoCode: "1",
                    Descriptor: {
                        CommonName: "name1",
                    },
                    Place: {},
                },
                {
                    AtcoCode: "2",
                    Descriptor: {
                        CommonName: "name2",
                    },
                    Place: {
                        Location: {
                            Latitude: 1,
                            Longitude: 4,
                        },
                    },
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            getNaptanStopAreasMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            const result = await processStopPoints(dbClient, stops, false, ["2"]);
            expect(insertStopsMock).toHaveBeenCalled();
            expect(result).toEqual([
                {
                    id: "2",
                    location_type: 0,
                    parent_station: null,
                    platform_code: null,
                    region_code: null,
                    stop_lat: 1,
                    stop_lon: 4,
                    stop_name: "name2",
                    wheelchair_boarding: 0,
                },
            ]);
        });

        it("returns false if any stops without lon/lat that are in the journey patterns", async () => {
            const stops: TxcStopPoint[] = [
                {
                    AtcoCode: "1",
                    Descriptor: {
                        CommonName: "name1",
                    },
                    Place: {},
                },
                {
                    AtcoCode: "2",
                    Descriptor: {
                        CommonName: "name2",
                    },
                    Place: {
                        Location: {
                            Latitude: 1,
                            Longitude: 4,
                        },
                    },
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            getNaptanStopAreasMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            const result = await processStopPoints(dbClient, stops, false, ["1", "2"]);
            expect(insertStopsMock).not.toHaveBeenCalled();
            expect(result).toBeFalsy();
        });
    });

    describe("processAnnotatedStopPointRefs", () => {
        it("inserts stops into the database and returns them", async () => {
            const stops: TxcAnnotatedStopPointRef[] = [
                {
                    StopPointRef: "1",
                    CommonName: "name1",
                    Location: {
                        Latitude: 2,
                        Longitude: 3,
                    },
                },
                {
                    StopPointRef: "4",
                    CommonName: "name2",
                    Location: {
                        Translation: {
                            Latitude: 5,
                            Longitude: 6,
                        },
                    },
                },
            ];

            const expectedStops: NewStop[] = [
                {
                    id: "1",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name1",
                    stop_lat: 2,
                    stop_lon: 3,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
                {
                    id: "4",
                    wheelchair_boarding: 0,
                    parent_station: null,
                    stop_name: "name2",
                    stop_lat: 5,
                    stop_lon: 6,
                    location_type: LocationType.StopOrPlatform,
                    platform_code: null,
                    region_code: null,
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            getNaptanStopAreasMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            await processAnnotatedStopPointRefs(dbClient, stops, false, []);
            expect(insertStopsMock).toHaveBeenCalledWith(dbClient, expectedStops);
        });
    });

    describe("getCoordinates", () => {
        it("returns the coordinates from the location, using Translation when present", () => {
            const location: StopPointLocation = {
                Translation: {
                    Latitude: 1,
                    Longitude: 2,
                    Easting: "535053",
                    Northing: "182711",
                },
                Easting: "535053",
                Northing: "182711",
                Latitude: 3,
                Longitude: 4,
            };

            const result = getCoordinates(location);
            expect(result).toEqual({ latitude: 1, longitude: 2 });
        });

        it("returns the coordinates from the location when translation is not present", () => {
            const location = {
                Latitude: 3,
                Longitude: 4,
            };

            const result = getCoordinates(location);
            expect(result).toEqual({ latitude: 3, longitude: 4 });
        });

        it("returns undefined coordinates when no location is provided", () => {
            const result = getCoordinates();
            expect(result).toEqual({ latitude: undefined, longitude: undefined });
        });

        it("returns undefined coordinates when only longitude is provided", () => {
            const location = {
                Longitude: 4,
            };

            const result = getCoordinates(location);
            expect(result).toEqual({ latitude: undefined, longitude: undefined });
        });

        it("returns the coordinates when easting and northing provided with incomplete lon/lat", () => {
            const location: StopPointLocation = {
                Longitude: 4,
                Easting: "535053",
                Northing: "182711",
            };

            const result = getCoordinates(location);
            expect(result).toEqual({ latitude: 51.527168897029235, longitude: -0.05455691862311166 });
        });

        it("returns the coordinates when easting and northing provided with incomplete lon/lat", () => {
            const location: StopPointLocation = {
                Longitude: 4,
                Translation: {
                    Easting: "1",
                    Northing: "2",
                },
                Easting: "3",
                Northing: "4",
            };

            const result = getCoordinates(location);
            expect(result).toEqual({ latitude: 49.76683816759407, longitude: -7.557151359370474 });
        });
    });

    describe("createStopAreaStop", () => {
        it("creates a stop area type of stop", () => {
            const stopArea: NaptanStopArea = {
                stop_area_code: "1",
                name: "stop_area_name",
                administrative_area_code: "a1",
                stop_area_type: "sa1",
                grid_type: null,
                easting: null,
                northing: null,
                longitude: "123",
                latitude: "456",
            };
            const result = createStopAreaStop(stopArea, LocationType.Station, "r1");
            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: WheelchairAccessibility.NoAccessibilityInformation,
                parent_station: null,
                stop_name: "stop_area_name",
                location_type: LocationType.Station,
                stop_lat: 456,
                stop_lon: 123,
                stop_code: null,
                platform_code: null,
                region_code: "r1",
            };

            expect(result).toEqual(expected);
        });

        it.each([
            ["123", null, "12", "34", -7.557032183529047, 49.767131940394414],
            [null, "456", "12", "34", -7.557032183529047, 49.767131940394414],
            [null, null, "12", "34", -7.557032183529047, 49.767131940394414],
            [null, null, "12", null, undefined, undefined],
            [null, null, null, "34", undefined, undefined],
        ])(
            "falls back to easting and northing if longitude and latitude are not present",
            (longitude, latitude, easting, northing, expectedLongitude, expectedLatitude) => {
                const stopArea: NaptanStopArea = {
                    stop_area_code: "1",
                    name: "stop_area_name",
                    administrative_area_code: "a1",
                    stop_area_type: "sa1",
                    grid_type: null,
                    easting,
                    northing,
                    longitude,
                    latitude,
                };
                const result = createStopAreaStop(stopArea, LocationType.EntranceOrExit, null);
                const expected: NewStop = {
                    id: "1",
                    wheelchair_boarding: WheelchairAccessibility.NoAccessibilityInformation,
                    parent_station: null,
                    stop_name: "stop_area_name",
                    location_type: LocationType.EntranceOrExit,
                    stop_lat: expectedLatitude,
                    stop_lon: expectedLongitude,
                    stop_code: null,
                    platform_code: null,
                    region_code: null,
                };

                expect(result).toEqual(expected);
            },
        );
    });

    describe("sanitiseIndicator", () => {
        it("returns null if the indicator is null", () => {
            const result = sanitiseIndicator(null);
            expect(result).toBeNull();
        });

        it("trims whitespace from the indicator", () => {
            const result = sanitiseIndicator("  platform 1  ");
            expect(result).toBe("1");
        });

        it("removes platform types from the start of the indicator", () => {
            const result = sanitiseIndicator("platform 1A");
            expect(result).toBe("1A");
        });

        it("handles invalid words after platform type", () => {
            const result = sanitiseIndicator("platform adj");
            expect(result).toBeNull();
        });

        it("returns null if the indicator contains an ignored word", () => {
            const result = sanitiseIndicator("opp station");
            expect(result).toBeNull();
        });

        it("returns the indicator unchanged if it does not start with a platform type or contain an ignored word", () => {
            const result = sanitiseIndicator("A1");
            expect(result).toBe("A1");
        });

        it("handles mixed case platform types", () => {
            const result = sanitiseIndicator("StAnD 5");
            expect(result).toBe("5");
        });

        it("handles mixed case ignored words", () => {
            const resultIgnored = sanitiseIndicator("OpPosite station");
            expect(resultIgnored).toBeNull();
        });
    });
});
