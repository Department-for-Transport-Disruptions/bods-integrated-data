import { Agency, KyselyDb, NewRoute, Route, RouteType } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import { processRoutes } from "./routes";

describe("routes", () => {
    const dbClient = vi.fn() as unknown as KyselyDb;
    const getTndsRouteMock = vi.spyOn(databaseFunctions, "getTndsRoute");
    const insertRoutesMock = vi.spyOn(databaseFunctions, "insertRoutes");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("inserts routes into the database and returns them when the service lines are BODS", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
            ServiceCode: "test-code",
            Lines: {
                Line: [
                    {
                        "@_id": "1",
                        LineName: "A",
                    },
                    {
                        "@_id": "2",
                        LineName: "B",
                    },
                ],
            },
        };

        const agency: Partial<Agency> = {
            id: 0,
            noc: "noc",
        };

        const expectedRoutes: NewRoute[] = [
            {
                line_id: "1",
                agency_id: 0,
                route_short_name: "A",
                route_long_name: "",
                route_type: RouteType.Bus,
                data_source: "bods",
                noc_line_name: "nocA",
            },
            {
                line_id: "2",
                agency_id: 0,
                route_short_name: "B",
                route_long_name: "",
                route_type: RouteType.Bus,
                data_source: "bods",
                noc_line_name: "nocB",
            },
        ];

        insertRoutesMock.mockImplementation((_dbClient, routes) => Promise.resolve(routes) as Promise<Route[]>);

        const result = await processRoutes(dbClient, service as Service, agency as Agency, false);
        expect(result).toEqual({ routes: expectedRoutes });
    });

    it("sets the route type as RouteType.CableCar for routes whose line names equal 'London Cable Car'", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
            ServiceCode: "test-code",
            Lines: {
                Line: [
                    {
                        "@_id": "1",
                        LineName: "London Cable Car",
                    },
                ],
            },
        };

        const agency: Partial<Agency> = {
            id: 0,
            noc: "noc",
        };

        const expectedRoutes: NewRoute[] = [
            {
                line_id: "1",
                agency_id: 0,
                route_short_name: "London Cable Car",
                route_long_name: "",
                route_type: RouteType.CableCar,
                data_source: "bods",
                noc_line_name: "nocLondon Cable Car",
            },
        ];

        insertRoutesMock.mockImplementation((_dbClient, routes) => Promise.resolve(routes) as Promise<Route[]>);

        const result = await processRoutes(dbClient, service as Service, agency as Agency, false);
        expect(result).toEqual({ routes: expectedRoutes });
    });

    it("inserts routes into the database and returns them when the service lines are TNDS", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
            ServiceCode: "test-code",
            Lines: {
                Line: [
                    {
                        "@_id": "1",
                        LineName: "A",
                    },
                    {
                        "@_id": "2",
                        LineName: "B",
                    },
                ],
            },
        };

        const agency: Partial<Agency> = {
            id: 0,
            noc: "noc",
        };

        const expectedRoutes: NewRoute[] = [
            {
                line_id: "test-code_1",
                agency_id: 0,
                route_short_name: "A",
                route_long_name: "",
                route_type: RouteType.Bus,
                data_source: "tnds",
                noc_line_name: "nocA",
            },
            {
                line_id: "test-code_2",
                agency_id: 0,
                route_short_name: "B",
                route_long_name: "",
                route_type: RouteType.Bus,
                data_source: "tnds",
                noc_line_name: "nocB",
            },
        ];

        getTndsRouteMock.mockResolvedValue(undefined);
        insertRoutesMock.mockImplementation((_dbClient, routes) => Promise.resolve(routes) as Promise<Route[]>);

        const result = await processRoutes(dbClient, service as Service, agency as Agency, true);
        expect(result).toEqual({ routes: expectedRoutes });
    });

    it("throws an error when a duplicate TNDS route is found", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
            ServiceCode: "test-code",
            Lines: {
                Line: [
                    {
                        "@_id": "1",
                        LineName: "A",
                    },
                ],
            },
        };

        const agency: Partial<Agency> = {
            id: 0,
            noc: "noc",
        };

        const expectedRoutes: NewRoute[] = [
            {
                line_id: "1",
                agency_id: 0,
                route_short_name: "A",
                route_long_name: "",
                route_type: RouteType.Bus,
                data_source: "bods",
                noc_line_name: "nocA",
            },
        ];

        getTndsRouteMock.mockResolvedValueOnce(expectedRoutes[0] as Route);
        insertRoutesMock.mockImplementation((_dbClient, routes) => Promise.resolve(routes) as Promise<Route[]>);

        const bodsResult = await processRoutes(dbClient, service as Service, agency as Agency, false);
        expect(bodsResult).toEqual({ routes: expectedRoutes });

        const tndsResult = await processRoutes(dbClient, service as Service, agency as Agency, true);
        expect(tndsResult).toEqual({ isDuplicateRoute: true });
    });

    it("throws an error when an unexpected error occurs", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
            ServiceCode: "test-code",
            Lines: {
                Line: [
                    {
                        "@_id": "1",
                        LineName: "A",
                    },
                ],
            },
        };

        const agency: Partial<Agency> = {
            id: 0,
            noc: "noc",
        };

        insertRoutesMock.mockRejectedValue(new Error("a"));

        await expect(processRoutes(dbClient, service as Service, agency as Agency, false)).rejects.toThrowError("a");
    });
});
