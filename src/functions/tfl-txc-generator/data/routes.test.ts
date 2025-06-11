import { describe, expect, it } from "vitest";
import { TflIBusData } from "./db";
import { generateRouteSections, generateRoutes } from "./routes";

const mockPatterns = [
    {
        stops: [
            {
                atco_code: "490000001A",
                short_destination_name: "Waterloo",
                common_name: "Waterloo Station",
            },
            {
                atco_code: "490000002B",
                short_destination_name: "Aldwych",
                common_name: "Aldwych",
            },
            {
                atco_code: "490000003C",
                short_destination_name: "Holborn",
                common_name: "Holborn Station",
            },
        ],
    },
    {
        stops: [
            {
                atco_code: "490000004D",
                short_destination_name: "Victoria",
                common_name: "Victoria Station",
            },
            {
                atco_code: "490000005E",
                short_destination_name: "Pimlico",
                common_name: "Pimlico",
            },
        ],
    },
];

describe("generateRouteSections", () => {
    it("generates correct RouteSection structure", () => {
        const result = generateRouteSections(mockPatterns as TflIBusData["patterns"]);
        expect(result.RouteSection).toEqual([
            {
                "@_id": "RS1",
                RouteLink: [
                    {
                        "@_id": "RL1-1",
                        From: {
                            StopPointRef: "490000001A",
                        },
                        To: {
                            StopPointRef: "490000002B",
                        },
                    },
                    {
                        "@_id": "RL1-2",
                        From: {
                            StopPointRef: "490000002B",
                        },
                        To: {
                            StopPointRef: "490000003C",
                        },
                    },
                ],
            },
            {
                "@_id": "RS2",
                RouteLink: [
                    {
                        "@_id": "RL2-1",
                        From: {
                            StopPointRef: "490000004D",
                        },
                        To: {
                            StopPointRef: "490000005E",
                        },
                    },
                ],
            },
        ]);
    });
});

describe("generateRoutes", () => {
    it("generates correct Route structure", () => {
        const result = generateRoutes(mockPatterns as TflIBusData["patterns"]);
        expect(result.Route).toEqual([
            {
                "@_id": "R1",
                Description: "To Holborn",
                RouteSectionRef: ["RS1"],
            },
            {
                "@_id": "R2",
                Description: "To Pimlico",
                RouteSectionRef: ["RS2"],
            },
        ]);
    });

    it("falls back to common_name if short_destination_name is missing", () => {
        const patterns = [
            {
                stops: [
                    { atco_code: "A", common_name: "Foo" },
                    { atco_code: "B", common_name: "Bar" },
                ],
            },
        ];
        const result = generateRoutes(patterns as TflIBusData["patterns"]);
        expect(result.Route[0].Description).toBe("To Bar");
    });
});
