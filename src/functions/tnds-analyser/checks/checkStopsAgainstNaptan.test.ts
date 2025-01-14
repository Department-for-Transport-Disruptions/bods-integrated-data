import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { describe, expect, it } from "vitest";
import checkStopsAgainstNaptan from "./checkStopsAgainstNaptan";
import { mockInvalidData, mockValidData } from "./mockData";

describe("checkStopsAgainstNaptan", () => {
    it("should return an observation if stop does not exist in NaPTAN or had incorrect stop type", () => {
        const naptanData = {
            SP1: "WRONG",
        };
        expect(checkStopsAgainstNaptan(mockInvalidData, naptanData)).toEqual<Observation[]>([
            {
                category: "stop",
                details:
                    "The Stop 1 (SP1) stop is registered as stop type WRONG with NaPTAN. Expected bus stop types are BCT,BCQ,BCS,BCE,BST.",
                importance: "critical",
                observation: "Incorrect stop type",
                service: "n/a",
            },
            {
                category: "stop",
                details:
                    "The Stop 2 (SP2) stop is not registered with NaPTAN. Please check the ATCO code is correct or contact your local authority to register this stop with NaPTAN.",
                importance: "advisory",
                observation: "Stop not found in NaPTAN",
                service: "n/a",
            },
        ]);
    });

    it("should return an empty array if stops have to correct stop type and exist in NaPTAN", () => {
        const naptanData = {
            SP1: "BCT",
            SP2: "BCT",
            SP4: "BCT",
        };

        expect(checkStopsAgainstNaptan(mockValidData, naptanData)).toEqual([]);
    });

    it("should return an empty array if there are no stops listed in TxC", () => {
        const naptanData = {
            SP1: "BCT",
            SP2: "BCT",
            SP4: "BCT",
        };

        expect(
            checkStopsAgainstNaptan(
                { TransXChange: { ...mockValidData.TransXChange, StopPoints: undefined } },
                naptanData,
            ),
        ).toEqual([]);
    });

    it("should return an empty array if stop exists in NaPTAN but there is no stop type in NaPTAN", () => {
        const naptanData = {
            SP1: null,
            SP2: null,
            SP4: "BCT",
        };

        expect(checkStopsAgainstNaptan(mockValidData, naptanData)).toEqual([]);
    });
});
