import { Database, LocationType, NaptanStop, NewStop, Stop } from "@bods-integrated-data/shared/database";
import { TxcAnnotatedStopPointRef, TxcStopPoint } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import { processAnnotatedStopPointRefs, processStopPoints, mapStop, NaptanStopWithRegionCode } from "./stops";

describe("stops", () => {
    let dbClient: Kysely<Database>;
    const getNaptanStopsMock = vi.spyOn(databaseFunctions, "getNaptanStops");
    const insertStopsMock = vi.spyOn(databaseFunctions, "insertStops");

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

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "naptan_name",
                stop_lat: 5,
                stop_lon: 6,
                location_type: LocationType.None,
                platform_code: "BCS",
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses the fallback name when it doesn't exist in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                stop_type: "BCS",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "name",
                stop_lat: 5,
                stop_lon: 6,
                location_type: LocationType.None,
                platform_code: "BCS",
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses the fallback coordinates when they doesn't exist in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "BCS",
            };

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "naptan_name",
                stop_lat: 2,
                stop_lon: 3,
                location_type: LocationType.None,
                platform_code: "BCS",
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses the RSE location when it is defined in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                stop_type: "RSE",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "naptan_name",
                stop_lat: 5,
                stop_lon: 6,
                location_type: LocationType.RealStationEntrance,
                platform_code: null,
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("uses a null platform_code when the stop_type doesn't exist in the naptan data", () => {
            const naptanStop: Partial<NaptanStop> = {
                naptan_code: "4",
                common_name: "naptan_name",
                latitude: "5",
                longitude: "6",
            };

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "naptan_name",
                stop_lat: 5,
                stop_lon: 6,
                location_type: LocationType.None,
                platform_code: null,
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
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

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "naptan_name",
                stop_lat: 5,
                stop_lon: 6,
                location_type: LocationType.None,
                platform_code: null,
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
            expect(result).toEqual(expected);
        });

        it("maps a stop using fallback data when no naptan stop exists", () => {
            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_name: "name",
                stop_lat: 2,
                stop_lon: 3,
                location_type: LocationType.None,
                platform_code: null,
                region_code: null,
            };

            const result = mapStop("1", "name", 2, 3);
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

            const expected: NewStop = {
                id: "1",
                wheelchair_boarding: 0,
                parent_station: null,
                stop_code: "4",
                stop_name: "naptan_name",
                stop_lat: 5,
                stop_lon: 6,
                location_type: LocationType.None,
                platform_code: "BCS",
                region_code: "Y",
            };

            const result = mapStop("1", "name", 2, 3, naptanStop as NaptanStopWithRegionCode);
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
                    Place: {},
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
                    stop_lat: undefined,
                    stop_lon: undefined,
                    location_type: LocationType.None,
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
                    location_type: LocationType.None,
                    platform_code: null,
                    region_code: null,
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            await processStopPoints(dbClient, stops, false);
            expect(insertStopsMock).toHaveBeenCalledWith(dbClient, expectedStops);
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
                    location_type: LocationType.None,
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
                    location_type: LocationType.None,
                    platform_code: null,
                    region_code: null,
                },
            ];

            getNaptanStopsMock.mockResolvedValue([]);
            insertStopsMock.mockImplementation(() => Promise.resolve());

            await processAnnotatedStopPointRefs(dbClient, stops, false);
            expect(insertStopsMock).toHaveBeenCalledWith(dbClient, expectedStops);
        });
    });
});
