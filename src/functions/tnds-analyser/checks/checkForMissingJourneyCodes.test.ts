import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";
import { describe, expect, it } from "vitest";
import checkForMissingJourneyCodes from "./checkForMissingJourneyCodes";

describe("checkForMissingJourneyCodes", () => {
    it("should return an empty array if there are no vehicle journeys", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [],
                },
            },
        };

        const result = checkForMissingJourneyCodes(data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if there are no missing vehicle journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
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
        } as PartialDeep<TxcSchema>;

        const result = checkForMissingJourneyCodes(data);
        expect(result).toEqual([]);
    });

    it("should return observations for missing vehicle journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
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
        } as PartialDeep<TxcSchema>;

        const result = checkForMissingJourneyCodes(data);
        expect(result).toEqual<Observation[]>([
            {
                importance: "critical",
                category: "journey",
                observation: "Missing journey code",
                service: "Line 1",
                details: "The (08:00) outbound journey is missing a journey code.",
                extraColumns: {
                    "Departure Time": "08:00",
                    Direction: "outbound",
                },
            },
            {
                importance: "critical",
                category: "journey",
                observation: "Missing journey code",
                service: "Line 1",
                details: "The (unknown departure time) unknown direction journey is missing a journey code.",
                extraColumns: {
                    "Departure Time": "unknown departure time",
                    Direction: "unknown direction",
                },
            },
        ]);
    });
});
