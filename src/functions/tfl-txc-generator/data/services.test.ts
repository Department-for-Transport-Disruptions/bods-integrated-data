import { describe, expect, it } from "vitest";
import { TflIBusData } from "./db";
import {
    generateJourneyPatternSections,
    generateServices,
    getOriginAndDestinationFromListOfPatterns,
    getStartAndEndDates,
} from "./services";

const mockPatterns = [
    {
        direction: 1,
        stops: [
            { atco_code: "A", short_destination_name: "Stop A", common_name: "A", timing_point_code: "T" },
            { atco_code: "B", short_destination_name: "Stop B", common_name: "B" },
            { atco_code: "C", common_name: "C", timing_point_code: "T" },
        ],
        journeys: [
            {
                calendar_days: [{ calendar_day: "2025-06-01" }, { calendar_day: "2025-06-02" }],
            },
        ],
    },
    {
        direction: 2,
        stops: [
            { atco_code: "Z", short_destination_name: "Stop A", common_name: "A" },
            { atco_code: "Y", short_destination_name: "Stop B", common_name: "B" },
            { atco_code: "X", short_destination_name: "Stop C", common_name: "C" },
        ],
        journeys: [
            {
                calendar_days: [{ calendar_day: "2025-06-01" }, { calendar_day: "2025-06-03" }],
            },
        ],
    },
];

describe("generateJourneyPatternSections", () => {
    it("generates correct JourneyPatternSection structure", () => {
        const result = generateJourneyPatternSections(mockPatterns as TflIBusData["patterns"]);
        expect(result.JourneyPatternSection[0]).toEqual({
            "@_id": "JPS1",
            JourneyPatternTimingLink: [
                {
                    "@_id": "JPTL1-1",
                    From: {
                        "@_SequenceNumber": 1,
                        Activity: "pickUp",
                        StopPointRef: "A",
                        TimingStatus: "principalTimingPoint",
                    },
                    RouteLinkRef: "RL1-1",
                    RunTime: "PT0M0S",
                    To: {
                        "@_SequenceNumber": 2,
                        Activity: "pickUpAndSetDown",
                        StopPointRef: "B",
                        TimingStatus: "otherPoint",
                    },
                },
                {
                    "@_id": "JPTL1-2",
                    From: {
                        "@_SequenceNumber": 2,
                        Activity: "pickUpAndSetDown",
                        StopPointRef: "B",
                        TimingStatus: "otherPoint",
                    },
                    RouteLinkRef: "RL1-2",
                    RunTime: "PT0M0S",
                    To: {
                        "@_SequenceNumber": 3,
                        Activity: "setDown",
                        StopPointRef: "C",
                        TimingStatus: "principalTimingPoint",
                    },
                },
            ],
        });
    });
});

describe("getOriginAndDestination", () => {
    it("returns correct origin and destination", () => {
        const result = getOriginAndDestinationFromListOfPatterns(mockPatterns as TflIBusData["patterns"]);
        expect(result.origin).toBe("Stop A");
        expect(result.destination).toBe("C");
    });
});

describe("getStartAndEndDates", () => {
    it("returns the earliest and latest calendar days", () => {
        const result = getStartAndEndDates(mockPatterns as TflIBusData["patterns"]);
        expect(result.startDate).toBe("2025-06-01");
        expect(result.endDate).toBe("2025-06-03");
    });
});

describe("generateServices", () => {
    it("generates a Service object with correct structure", () => {
        const result = generateServices(mockPatterns as TflIBusData["patterns"], "Line1");
        expect(result.Service).toEqual({
            Lines: {
                Line: [
                    {
                        "@_id": "TFLO:UZ000TFLO:Line1:Line1",
                        LineName: "Line1",
                        OutboundDescription: {
                            Origin: "Stop A",
                            Destination: "C",
                            Description: "To C",
                        },
                    },
                ],
            },
            OperatingPeriod: {
                EndDate: "2025-06-03",
                StartDate: "2025-06-01",
            },
            PublicUse: "true",
            RegisteredOperatorRef: "TFLO",
            ServiceCode: "UZ000TFLO:Line1",
            StandardService: {
                Destination: "C",
                JourneyPattern: [
                    {
                        "@_id": "JP1",
                        DestinationDisplay: "C",
                        Direction: "outbound",
                        JourneyPatternSectionRefs: ["JPS1"],
                        OperatorRef: "TFLO",
                        RouteRef: "R1",
                    },
                    {
                        "@_id": "JP2",
                        DestinationDisplay: "Stop C",
                        Direction: "inbound",
                        JourneyPatternSectionRefs: ["JPS2"],
                        OperatorRef: "TFLO",
                        RouteRef: "R2",
                    },
                ],
                Origin: "Stop A",
            },
        });
    });
});
