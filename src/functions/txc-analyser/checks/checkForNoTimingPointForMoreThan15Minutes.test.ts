import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { PartialDeep } from "type-fest";
import { describe, expect, it } from "vitest";
import checkForNoTimingPointForThan15Minutes from "./checkForNoTimingPointForThan15Minutes";
import { mockValidData } from "./mockData";

describe("checkForNoTimingPointForThan15Minutes", () => {
    it("returns no observations if there are no journey pattern sections", () => {
        const txc: PartialDeep<TxcSchema> = {
            TransXChange: {
                ...mockValidData.TransXChange,
                JourneyPatternSections: {
                    JourneyPatternSection: [],
                },
            },
        };
        expect(checkForNoTimingPointForThan15Minutes(txc)).toEqual([]);
    });

    it("returns an empty array if all timing links are under or equal 15 minutes", () => {
        const txc: PartialDeep<TxcSchema> = {
            TransXChange: {
                ...mockValidData.TransXChange,
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            ServiceRef: "SR1",
                            LineRef: "LR1",
                            VehicleJourneyTimingLink: [
                                {
                                    "@_id": "VJTL1",
                                    JourneyPatternTimingLinkRef: "JPTL1",
                                    RunTime: "PT10M0S",
                                },
                                {
                                    "@_id": "VJTL2",
                                    JourneyPatternTimingLinkRef: "JPTL2",
                                    RunTime: "PT5M0S",
                                },
                            ],
                        },
                    ],
                },
                JourneyPatternSections: {
                    JourneyPatternSection: [
                        {
                            "@_id": "JPS1",
                            JourneyPatternTimingLink: [
                                {
                                    "@_id": "JPTL1",
                                    From: { StopPointRef: "SP1", TimingStatus: "PTP" },
                                    To: { StopPointRef: "SP2", TimingStatus: "OTH" },
                                    RunTime: "PT5M0S",
                                },
                                {
                                    "@_id": "JPTL2",
                                    From: { StopPointRef: "SP2", TimingStatus: "OTH" },
                                    To: { StopPointRef: "SP3", TimingStatus: "PTP" },
                                    RunTime: "PT10M0S",
                                },
                            ],
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;
        expect(checkForNoTimingPointForThan15Minutes(txc)).toEqual([]);
    });

    it("returns an observation if a timing link is over 15 minutes", () => {
        const txc: PartialDeep<TxcSchema> = {
            TransXChange: {
                ...mockValidData.TransXChange,
                VehicleJourneys: {
                    VehicleJourney: [
                        {
                            ServiceRef: "SR1",
                            LineRef: "LR1",
                            VehicleJourneyTimingLink: [
                                {
                                    "@_id": "VJTL1",
                                    JourneyPatternTimingLinkRef: "JPTL1",
                                    RunTime: "PT10M0S",
                                },
                                {
                                    "@_id": "VJTL2",
                                    JourneyPatternTimingLinkRef: "JPTL2",
                                },
                                {
                                    "@_id": "VJTL3",
                                    JourneyPatternTimingLinkRef: "JPTL3",
                                    RunTime: "PT0M2S",
                                },
                            ],
                        },
                    ],
                },
                JourneyPatternSections: {
                    JourneyPatternSection: [
                        {
                            "@_id": "JPS1",
                            JourneyPatternTimingLink: [
                                {
                                    "@_id": "JPTL1",
                                    From: { StopPointRef: "SP1", TimingStatus: "PTP" },
                                    To: { StopPointRef: "SP2", TimingStatus: "OTH" },
                                    RunTime: "PT20M0S",
                                },
                                {
                                    "@_id": "JPTL2",
                                    From: { StopPointRef: "SP2", TimingStatus: "OTH" },
                                    To: { StopPointRef: "SP3" },
                                    RunTime: "PT4M59S",
                                },
                                {
                                    "@_id": "JPTL3",
                                    From: { StopPointRef: "SP3", TimingStatus: "OTH" },
                                    To: { StopPointRef: "SP4", TimingStatus: "PTP" },
                                    RunTime: "PT10M0S",
                                },
                            ],
                        },
                    ],
                },
            },
        } as PartialDeep<TxcSchema>;
        const result = checkForNoTimingPointForThan15Minutes(txc);
        expect(result.length).toBe(1);
        expect(result[0].observation).toBe("No timing point for more than 15 minutes");
    });
});
