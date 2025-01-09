import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";
import { describe, expect, it, vi } from "vitest";
import checkForDuplicateJourneys from "./checkForDuplicateJourneys";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("checkForDuplicateJourneys", () => {
    it("should return an empty array if there are no vehicle journeys", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [],
                },
            },
        };

        const result = checkForDuplicateJourneys("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if all vehicle journeys are unique", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            JourneyPatternRef: "JP1",
                            DepartureTime: "08:00",
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Monday: "",
                                        Tuesday: "",
                                    },
                                },
                            },
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            JourneyPatternRef: "JP1",
                            DepartureTime: "08:30",
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Tuesday: "",
                                        Monday: "",
                                    },
                                },
                            },
                        },
                        {
                            VehicleJourneyCode: "VJ3",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            VehicleJourneyRef: "JP2",
                            DepartureTime: "08:00",
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
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Monday: "",
                                        Tuesday: "",
                                    },
                                },
                            },
                            StandardService: {
                                JourneyPattern: [
                                    {
                                        "@_id": "JP1",
                                        RouteRef: "R1",
                                    },
                                    {
                                        "@_id": "JP2",
                                        RouteRef: "R2",
                                    },
                                    {
                                        "@_id": "JP3",
                                        RouteRef: "R1",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;

        const result = checkForDuplicateJourneys("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return observations for duplicate journey codes", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            VehicleJourneyCode: "VJ1",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            JourneyPatternRef: "JP1",
                            DepartureTime: "08:00",
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Monday: "",
                                        Tuesday: "",
                                    },
                                },
                            },
                        },
                        {
                            VehicleJourneyCode: "VJ2",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            JourneyPatternRef: "JP1",
                            DepartureTime: "08:00",
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Tuesday: "",
                                        Monday: "",
                                    },
                                },
                            },
                        },
                        {
                            VehicleJourneyCode: "VJ3",
                            ServiceRef: "service1",
                            LineRef: "line1",
                            VehicleJourneyRef: "JP3",
                            DepartureTime: "08:00",
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
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Monday: "",
                                        Tuesday: "",
                                    },
                                },
                            },
                            StandardService: {
                                JourneyPattern: [
                                    {
                                        "@_id": "JP1",
                                        RouteRef: "R1",
                                    },
                                    {
                                        "@_id": "JP2",
                                        RouteRef: "R2",
                                    },
                                    {
                                        "@_id": "JP3",
                                        RouteRef: "R1",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;

        const result = checkForDuplicateJourneys("testfile.xml", data);
        expect(result).toEqual<Observation[]>([
            {
                PK: "testfile.xml",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "advisory",
                category: "journey",
                observation: "Duplicate journey",
                registrationNumber: "service1",
                service: "Line 1",
                details:
                    "The journey (with code VJ2) has the same departure time, route and operating profile as another journey.",
            },
        ]);
    });
});
