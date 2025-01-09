import { describe, expect, it, vi } from "vitest";
import checkFirstStopAndLastStopTimingPoints from "./checkFirstStopAndLastStopTimingPoints";
import { mockInvalidData, mockValidData } from "./mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("checkFirstStopAndLastTimingPoints", () => {
    const filename = "test-file";
    it("should return observations if first stop and last stop are not timing points", () => {
        const expectedObservation = [
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "timing",
                details: "The first stop (Stop 1) on the 08:00 outbound journey is not set as a timing point.",
                importance: "critical",
                observation: "First stop is not a timing point",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "timing",
                details: "The last stop (Stop 2) on the 08:00 outbound journey is not set as a timing point.",
                importance: "critical",
                observation: "Last stop is not a timing point",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
        ];
        expect(checkFirstStopAndLastStopTimingPoints(filename, mockInvalidData)).toEqual(expectedObservation);
    });

    it("should return an empty array if first stop and last stop have correct activity", () => {
        expect(checkFirstStopAndLastStopTimingPoints(filename, mockValidData)).toEqual([]);
    });

    it("should return observations if first stop and last stop do not have a timing status", () => {
        const expectedObservation = [
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "timing",
                details: "The first stop (Stop 1) on the 08:00 outbound journey is not set as a timing point.",
                importance: "critical",
                observation: "First stop is not a timing point",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "timing",
                details: "The last stop (Stop 4) on the 08:00 outbound journey is not set as a timing point.",
                importance: "critical",
                observation: "Last stop is not a timing point",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
        ];
        expect(
            checkFirstStopAndLastStopTimingPoints(filename, {
                TransXChange: {
                    ...mockValidData.TransXChange,
                    JourneyPatternSections: {
                        JourneyPatternSection: [
                            {
                                "@_id": "JPS1",
                                JourneyPatternTimingLink: [
                                    {
                                        "@_id": "JPTL1",
                                        From: {
                                            Activity: "pickUp",
                                            StopPointRef: "SP1",
                                            WaitTime: "00:02",
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                            TimingStatus: "PTP",
                                            WaitTime: "00:03",
                                        },
                                        RunTime: "00:10",
                                    },
                                ],
                            },
                            {
                                "@_id": "JPS2",
                                JourneyPatternTimingLink: [
                                    {
                                        "@_id": "JPTL2",
                                        From: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP3",
                                            TimingStatus: "PTP",
                                            WaitTime: "00:01",
                                        },
                                        To: {
                                            Activity: "setDown",
                                            StopPointRef: "SP4",
                                            WaitTime: "00:02",
                                        },
                                        RunTime: "00:08",
                                    },
                                ],
                            },
                        ],
                    },
                },
            }),
        ).toEqual(expectedObservation);
    });

    it("should return an empty array if a first stop and last stop have correct activity", () => {
        expect(
            checkFirstStopAndLastStopTimingPoints(filename, {
                TransXChange: {
                    ...mockValidData.TransXChange,
                    JourneyPatternSections: {
                        JourneyPatternSection: undefined,
                    },
                },
            }),
        ).toEqual([]);
    });
});
