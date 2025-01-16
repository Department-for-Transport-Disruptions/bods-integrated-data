import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";
import { describe, expect, it } from "vitest";
import checkForDuplicateJourneyCodes from "./checkForDuplicateJourneyCodes";

describe("checkForDuplicateJourneyCodes", () => {
    it("should return an empty array if there are no vehicle journeys", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [],
                },
            },
        };

        const result = checkForDuplicateJourneyCodes(data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if all vehicle journeys have unique journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
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
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;

        const result = checkForDuplicateJourneyCodes(data);
        expect(result).toEqual([]);
    });

    it("should return observations for duplicate journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ3",
                            ServiceRef: "SVC1",
                            LineRef: "line1",
                        },
                    ],
                },
                Services: {
                    Service: [
                        {
                            ServiceCode: "SVC1",
                            Lines: {
                                Line: [
                                    {
                                        "@_id": "line1",
                                        LineName: "Line 1",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;

        const result = checkForDuplicateJourneyCodes(data);
        expect(result).toEqual<Observation[]>([
            {
                importance: "advisory",
                category: "journey",
                observation: "Duplicate journey code",
                serviceCode: "SVC1",
                lineName: "Line 1",
                details: "The Journey Code (VJ1) is found in more than one vehicle journey.",
            },
            {
                importance: "advisory",
                category: "journey",
                observation: "Duplicate journey code",
                serviceCode: "SVC1",
                lineName: "Line 1",
                details: "The Journey Code (VJ2) is found in more than one vehicle journey.",
            },
        ]);
    });
});
