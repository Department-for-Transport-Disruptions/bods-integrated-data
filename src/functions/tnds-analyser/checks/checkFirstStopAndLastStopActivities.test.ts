import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";
import { describe, expect, it } from "vitest";
import checkFirstStopAndLastStopActivities from "./checkFirstStopAndLastStopActivities";
import { mockInvalidData, mockValidData } from "./mockData";

describe("checkFirstStopAndLastStopActivities", () => {
    it("should return observations if first stop and last stop have incorrect activity", () => {
        const expectedObservation: Observation[] = [
            {
                category: "stop",
                details:
                    "The first stop (Stop 1) on the 08:00:00 outbound journey is incorrectly set to set down passengers.",
                importance: "critical",
                observation: "First stop is set down only",
                service: "Line 1",
            },
            {
                category: "stop",
                details:
                    "The last stop (Stop 2) on the 08:00:00 outbound journey is incorrectly set to pick up passengers.",
                importance: "critical",
                observation: "Last stop is pick up only",
                service: "Line 1",
            },
        ];
        expect(checkFirstStopAndLastStopActivities(mockInvalidData)).toEqual(expectedObservation);
    });

    it("should return an empty array if a first stop and last stop have correct activity", () => {
        expect(checkFirstStopAndLastStopActivities(mockValidData)).toEqual([]);
    });

    it("should return an empty array if first and last stop do not have any activity properties", () => {
        const expectedObservation: Observation[] = [
            {
                category: "stop",
                details:
                    "The first stop (Stop 1) on the 08:00:00 outbound journey is incorrectly set to set down passengers.",
                importance: "critical",
                observation: "First stop is set down only",
                service: "Line 1",
            },
            {
                category: "stop",
                details:
                    "The last stop (Stop 4) on the 08:00:00 outbound journey is incorrectly set to pick up passengers.",
                importance: "critical",
                observation: "Last stop is pick up only",
                service: "Line 1",
            },
        ];
        expect(
            checkFirstStopAndLastStopActivities({
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

    it("should return observations if a journey does not have a journey pattern to determine stop activities from", () => {
        const expectedObservation: Observation[] = [
            {
                category: "stop",
                details:
                    "The first stop (n/a) on the 08:00:00 outbound journey is incorrectly set to set down passengers.",
                importance: "critical",
                observation: "First stop is set down only",
                service: "Line 1",
            },
            {
                category: "stop",
                details:
                    "The last stop (n/a) on the 08:00:00 outbound journey is incorrectly set to pick up passengers.",
                importance: "critical",
                observation: "Last stop is pick up only",
                service: "Line 1",
            },
        ];
        expect(
            checkFirstStopAndLastStopActivities({
                TransXChange: {
                    ...mockValidData.TransXChange,
                    JourneyPatternSections: {
                        JourneyPatternSection: undefined,
                    },
                },
            }),
        ).toEqual(expectedObservation);
    });

    it("should return observations if first stop and last stop have incorrect activity and departure time cannot be determined", () => {
        const expectedObservation: Observation[] = [
            {
                category: "stop",
                details:
                    "The first stop (Stop 1) on the unknown departure time outbound journey is incorrectly set to set down passengers.",
                importance: "critical",
                observation: "First stop is set down only",
                service: "Line 1",
            },
            {
                category: "stop",
                details:
                    "The last stop (Stop 2) on the unknown departure time outbound journey is incorrectly set to pick up passengers.",
                importance: "critical",
                observation: "Last stop is pick up only",
                service: "Line 1",
            },
        ];
        expect(
            checkFirstStopAndLastStopActivities({
                TransXChange: {
                    ...mockInvalidData.TransXChange,
                    VehicleJourneys: {
                        VehicleJourney: [
                            {
                                "@_RevisionNumber": "1",
                                VehicleJourneyCode: "VJ12345",
                                DestinationDisplay: "Central Station",
                                Frequency: {
                                    EndTime: "18:00",
                                    Interval: {
                                        ScheduledFrequency: "15",
                                    },
                                },
                                Operational: {
                                    TicketMachine: {
                                        TicketMachineServiceCode: "TM123",
                                        JourneyCode: "JC123",
                                    },
                                    VehicleType: {
                                        WheelchairAccessible: true,
                                        VehicleEquipment: {
                                            WheelchairEquipment: {
                                                NumberOfWheelchairAreas: 2,
                                            },
                                        },
                                    },
                                },
                                ServiceRef: "SVC1",
                                LineRef: "L1",
                                JourneyPatternRef: "JP1",
                                VehicleJourneyRef: "VJR123",
                                VehicleJourneyTimingLink: [
                                    {
                                        "@_id": "VJTL123",
                                        JourneyPatternTimingLinkRef: "JPTL1",
                                        From: {
                                            Activity: "pickUp",
                                            StopPointRef: "SP1",
                                            TimingStatus: "scheduled",
                                            WaitTime: "00:02",
                                        },
                                        To: {
                                            Activity: "dropOff",
                                            StopPointRef: "SP2",
                                            TimingStatus: "scheduled",
                                            WaitTime: "00:03",
                                        },
                                        RunTime: "00:10",
                                    },
                                ],
                            },
                        ],
                    },
                },
            } as PartialDeep<TxcSchema>),
        ).toEqual(expectedObservation);
    });
});
