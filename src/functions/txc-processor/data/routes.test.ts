import { Agency, Database, NewRoute, Route, RouteType } from "@bods-integrated-data/shared/database";
import { Service } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as databaseFunctions from "./database";
import { insertRoutes } from "./routes";

describe("insertRoutes", () => {
    let dbClient: Kysely<Database>;
    const getBodsRouteMock = vi.spyOn(databaseFunctions, "getBodsRoute");
    const getTndsRouteMock = vi.spyOn(databaseFunctions, "getTndsRoute");
    const insertRouteMock = vi.spyOn(databaseFunctions, "insertRoute");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns routes when the service lines are BODS", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
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

        getBodsRouteMock.mockResolvedValue(undefined);
        insertRouteMock.mockImplementation((_dbClient, route) => Promise.resolve(route) as Promise<Route>);

        const result = await insertRoutes(dbClient, service as Service, agency as Agency, false);
        expect(result).toEqual({ routes: expectedRoutes });
    });

    it("returns routes when the service lines are TNDS", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
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
                data_source: "tnds",
                noc_line_name: "nocA",
            },
            {
                line_id: "2",
                agency_id: 0,
                route_short_name: "B",
                route_long_name: "",
                route_type: RouteType.Bus,
                data_source: "tnds",
                noc_line_name: "nocB",
            },
        ];

        getTndsRouteMock.mockResolvedValue(undefined);
        insertRouteMock.mockImplementation((_dbClient, route) => Promise.resolve(route) as Promise<Route>);

        const result = await insertRoutes(dbClient, service as Service, agency as Agency, true);
        expect(result).toEqual({ routes: expectedRoutes });
    });

    it("throws an error when a duplicate TNDS route is found", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
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

        getBodsRouteMock.mockResolvedValueOnce(undefined);
        getTndsRouteMock.mockResolvedValueOnce(expectedRoutes[0] as Route);
        insertRouteMock.mockImplementation((_dbClient, route) => Promise.resolve(route) as Promise<Route>);

        const bodsResult = await insertRoutes(dbClient, service as Service, agency as Agency, false);
        expect(bodsResult).toEqual({ routes: expectedRoutes });

        const tndsResult = await insertRoutes(dbClient, service as Service, agency as Agency, true);
        expect(tndsResult).toEqual({ isDuplicateRoute: true });
    });

    it("throws an error when an unexpected error occurs ", async () => {
        const service: Partial<Service> = {
            RegisteredOperatorRef: "1",
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

        getBodsRouteMock.mockResolvedValueOnce(undefined);
        insertRouteMock.mockRejectedValue(new Error("a"));

        await expect(insertRoutes(dbClient, service as Service, agency as Agency, false)).rejects.toThrowError("a");
    });
});
