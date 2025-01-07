import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { describe, expect, it } from "vitest";
import checkForDuplicateJourneyCodes from "./checkForDuplicateJourneyCodes";

describe("checkForDuplicateJourneyCodes", () => {
    it("should return an empty array if there are no vehicle journeys", () => {
        const data: Partial<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [],
                },
            },
        };

        const result = checkForDuplicateJourneyCodes("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if all vehicle journeys have unique journey codes", () => {
        const data: Partial<TxcSchema> = {
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
        } as Partial<TxcSchema>;

        const result = checkForDuplicateJourneyCodes("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return observations for duplicate journey codes", () => {
        const data: Partial<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "service1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "service1",
                            LineRef: "line1",
                        },
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
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "service1",
                            LineRef: "line1",
                        },
                        {
                            VehicleJourneyCode: "VJ3",
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
        } as Partial<TxcSchema>;

        const result = checkForDuplicateJourneyCodes("testfile.xml", data);
        expect(result).toEqual([
            {
                PK: "testfile.xml",
                SK: expect.any(String),
                importance: "critical",
                category: "journey",
                observation: "Duplicate journey code",
                registrationNumber: "service1",
                service: "Line 1",
                details: "The Journey Code (VJ1) is found in more than one vehicle journey.",
            },
            {
                PK: "testfile.xml",
                SK: expect.any(String),
                importance: "critical",
                category: "journey",
                observation: "Duplicate journey code",
                registrationNumber: "service1",
                service: "Line 1",
                details: "The Journey Code (VJ2) is found in more than one vehicle journey.",
            },
        ]);
    });
});
