import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
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

    it("should return an empty array if there are no missing journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            DepartureTime: "08:00",
                            Operational: {
                                TicketMachine: {
                                    JourneyCode: "J1",
                                },
                            },
                        },
                        {
                            VehicleJourneyCode: "V21",
                            DepartureTime: "08:30",
                            Operational: {
                                TicketMachine: {
                                    JourneyCode: "J2",
                                },
                            },
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;

        const result = checkForMissingJourneyCodes(data);
        expect(result).toEqual([]);
    });

    it("should return observations for missing journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                            DepartureTime: "08:00",
                            JourneyPatternRef: "JP1",
                            Operational: {
                                TicketMachine: {
                                    JourneyCode: "",
                                },
                            },
                        },
                        {
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                            Operational: {
                                TicketMachine: {
                                    JourneyCode: "J2",
                                },
                            },
                        },
                    ],
                },
                Services: {
                    Service: [
                        {
                            ServiceCode: "SVC1",
                            OperatingPeriod: {},
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
                serviceCode: "SVC1",
                lineName: "Line 1",
                latestEndDate: "n/a",
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
                serviceCode: "SVC1",
                lineName: "Line 1",
                latestEndDate: "n/a",
                details: "The (unknown departure time) unknown direction journey is missing a journey code.",
                extraColumns: {
                    "Departure Time": "unknown departure time",
                    Direction: "unknown direction",
                },
            },
        ]);
    });
});
