import { describe, expect, it, vi } from "vitest";
import checkForNoTimingPointForThan15Minutes from "./checkForNoTimingPointForThan15Minutes";
import { mockValidData } from "./mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));
describe("checkForNoTimingPointForMoreThan15Minutes", () => {
    const filename = "test-file";
    it("should record observations if there is not timing point for more than 15 minutes for a given vehicle journey", () => {
        const expectedObservations = [
            {
                PK: "test-file",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "timing",
                details:
                    "The link between the 08:00:00 SP2 (SP2) and 08:20:00 SP3 (SP3) timing point stops on the 08:00:00 outbound journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.",
                importance: "advisory",
                observation: "No timing point for more than 15 minutes",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
            {
                PK: "test-file",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "timing",
                details:
                    "The link between the 08:40:00 SP4 (SP4) and 09:00:00 SP5 (SP5) timing point stops on the 08:00:00 outbound journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.",
                importance: "advisory",
                observation: "No timing point for more than 15 minutes",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
        ];
        expect(
            checkForNoTimingPointForThan15Minutes(filename, {
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
                                            TimingStatus: "PTP",
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                            TimingStatus: "OTH",
                                        },
                                        RunTime: "PT0M0S",
                                    },
                                    {
                                        "@_id": "JPTL1-2",
                                        From: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                            TimingStatus: "OTH",
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP3",
                                            TimingStatus: "OTH",
                                        },
                                        RunTime: "PT20M0S",
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
                                            TimingStatus: "OTH",
                                            WaitTime: "00:03",
                                        },
                                        To: {
                                            Activity: "setDown",
                                            StopPointRef: "SP4",
                                            TimingStatus: "PTP",
                                        },
                                        RunTime: "PT20M0S",
                                    },
                                    {
                                        "@_id": "JPTL2-1",
                                        From: {
                                            Activity: "setDown",
                                            StopPointRef: "SP4",
                                            TimingStatus: "PTP",
                                        },
                                        To: {
                                            Activity: "setDown",
                                            StopPointRef: "SP5",
                                            TimingStatus: "OTH",
                                        },
                                        RunTime: "PT20M0S",
                                    },
                                ],
                            },
                        ],
                    },
                },
            }),
        ).toEqual(expectedObservations);
    });
    it("should record no observations if there are timing points at least every 15 minutes for a given vehicle journey", () => {
        expect(checkForNoTimingPointForThan15Minutes(filename, mockValidData)).toEqual([]);
    });

    it.each([
        [
            {
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
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                        },
                                        RunTime: "PT0M0S",
                                    },
                                    {
                                        "@_id": "JPTL1-2",
                                        From: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP3",
                                        },
                                        RunTime: "PT20M0S",
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            [
                {
                    PK: "test-file",
                    SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                    category: "timing",
                    details:
                        "The link between the 08:00:00 SP2 (SP2) and 08:20:00 SP3 (SP3) timing point stops on the 08:00:00 outbound journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.",
                    importance: "advisory",
                    observation: "No timing point for more than 15 minutes",
                    registrationNumber: "SVC1",
                    service: "Line 1",
                },
            ],
        ],
        [
            {
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
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                        },
                                        RunTime: "PT0M0S",
                                    },
                                    {
                                        "@_id": "JPTL1",
                                        From: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP3",
                                        },
                                        RunTime: "PT10M0S",
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            [],
        ],
    ])("should handle missing timing statuses: %o", (txcData, expectedObservation) => {
        expect(checkForNoTimingPointForThan15Minutes(filename, txcData)).toEqual(expectedObservation);
    });
});
