import { describe, expect, it } from "vitest";
import checkForNoTimingPointForThan15Minutes from "./checkForNoTimingPointForThan15Minutes";
import { mockValidData } from "./mockData";

describe("checkForNoTimingPointForMoreThan15Minutes", () => {
    it("should record observations if there are any consecutive timing points more than 15 minutes apart for a given vehicle journey", () => {
        const expectedObservations = [
            {
                PK: "",
                SK: "",
                category: "timing",
                details:
                    "The link between the 08:00:00 Stop 2 (SP2) and 08:20:00 n/a (SP3) timing point stops on the 08:00:00 outbound journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.",
                importance: "advisory",
                observation: "No timing point for more than 15 minutes",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
            {
                PK: "",
                SK: "",
                category: "timing",
                details:
                    "The link between the 08:40:00 Stop 4 (SP4) and 09:00:00 n/a (SP5) timing point stops on the 08:00:00 outbound journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.",
                importance: "advisory",
                observation: "No timing point for more than 15 minutes",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
        ];
        expect(
            checkForNoTimingPointForThan15Minutes({
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
                                            WaitTime: "PT0M0S",
                                        },
                                        RunTime: "PT0M0S",
                                    },
                                    {
                                        "@_id": "JPTL1-2",
                                        From: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP2",
                                            TimingStatus: "OTH",
                                            WaitTime: "PT0M0S",
                                        },
                                        To: {
                                            Activity: "pickUpAndSetDown",
                                            StopPointRef: "SP3",
                                            TimingStatus: "OTH",
                                            WaitTime: "PT10M0S",
                                        },
                                        RunTime: "PT10M0S",
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
                                            WaitTime: "PT10M0S",
                                        },
                                        To: {
                                            Activity: "setDown",
                                            StopPointRef: "SP4",
                                            TimingStatus: "PTP",
                                            WaitTime: "PT10M0S",
                                        },
                                        RunTime: "PT10M0S",
                                    },
                                    {
                                        "@_id": "JPTL2-1",
                                        From: {
                                            Activity: "setDown",
                                            StopPointRef: "SP4",
                                            TimingStatus: "PTP",
                                            WaitTime: "PT10M0S",
                                        },
                                        To: {
                                            Activity: "setDown",
                                            StopPointRef: "SP5",
                                            TimingStatus: "OTH",
                                            WaitTime: "PT10M0S",
                                        },
                                        RunTime: "PT10M0S",
                                    },
                                ],
                            },
                        ],
                    },
                },
            }),
        ).toEqual(expectedObservations);
    });
    it("should record no observations if there are no consecutive timing points more than 15 minutes apart for a given vehicle journey", () => {
        expect(checkForNoTimingPointForThan15Minutes(mockValidData)).toEqual([]);
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
                    PK: "",
                    SK: "",
                    category: "timing",
                    details:
                        "The link between the 08:00:00 Stop 2 (SP2) and 08:20:00 n/a (SP3) timing point stops on the 08:00:00 outbound journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.",
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
        expect(checkForNoTimingPointForThan15Minutes(txcData)).toEqual(expectedObservation);
    });

    it("should handle missing run times", () => {
        expect(
            checkForNoTimingPointForThan15Minutes({
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
                                    },
                                    {
                                        "@_id": "JPTL1",
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
                                    },
                                ],
                            },
                        ],
                    },
                },
            }),
        ).toEqual([]);
    });
});
