import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { describe, expect, it, vi } from "vitest";
import checkForMissingJourneyCodes from "./checkForMissingJourneyCodes";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("checkForMissingJourneyCodes", () => {
    it("should return an empty array if there are no vehicle journeys", () => {
        const data: Partial<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [],
                },
            },
        };

        const result = checkForMissingJourneyCodes("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if there are no missing vehicle journey codes", () => {
        const data: Partial<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            DepartureTime: "08:00",
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            DepartureTime: "08:30",
                        },
                    ],
                },
            },
        } as Partial<TxcSchema>;

        const result = checkForMissingJourneyCodes("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return observations for missing vehicle journey codes", () => {
        const data: Partial<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            DepartureTime: "08:00",
                            JourneyPatternRef: "JP1",
                        },
                        {
                            ServiceRef: "service1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "service1",
                            LineRef: "line1",
                        },
                    ],
                },
                Services: {
                    Service: [
                        {
                            ServiceCode: "service1",
                            Lines: {
                                Line: [
                                    {
                                        "@_id": "line1",
                                        LineName: "Line 1",
                                    },
                                ],
                            },
                            StandardService: {
                                JourneyPattern: [
                                    {
                                        "@_id": "JP1",
                                        Direction: "outbound",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        } as Partial<TxcSchema>;

        const result = checkForMissingJourneyCodes("testfile.xml", data);
        expect(result).toEqual<Observation[]>([
            {
                PK: "testfile.xml",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "critical",
                category: "journey",
                observation: "Missing journey code",
                registrationNumber: "service1",
                service: "Line 1",
                details: "The (08:00) outbound journey is missing a journey code.",
            },
            {
                PK: "testfile.xml",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "critical",
                category: "journey",
                observation: "Missing journey code",
                registrationNumber: "service1",
                service: "Line 1",
                details: "The (unknown departure time) journey is missing a journey code.",
            },
        ]);
    });
});
