import { NaptanStopMap, Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { describe, expect, it } from "vitest";
import checkStopsAgainstNaptan from "./checkStopsAgainstNaptan";
import { mockInvalidData, mockValidData } from "./mockData";

describe("checkStopsAgainstNaptan", () => {
    it("should return an observation if stop does not exist in NaPTAN or had incorrect stop type", () => {
        const naptanStopMap: NaptanStopMap = {
            SP1: {
                stopType: "WRONG",
                regions: [],
            },
        };
        expect(checkStopsAgainstNaptan(mockInvalidData, naptanStopMap)).toEqual<Observation[]>([
            {
                category: "stop",
                details:
                    "The Stop 1 (SP1) stop is registered as stop type WRONG with NaPTAN. Expected bus stop types are BCT,BCQ,BCS,BCE,BST.",
                importance: "critical",
                observation: "Incorrect stop type",
                serviceCode: "n/a",
                lineName: "n/a",
                extraColumns: {
                    "Stop Name": "Stop 1",
                    "Stop Point Ref": "SP1",
                },
            },
            {
                category: "stop",
                details:
                    "The Stop 2 (SP2) stop is not registered with NaPTAN. Please check the ATCO code is correct or contact your local authority to register this stop with NaPTAN.",
                importance: "advisory",
                observation: "Stop not found in NaPTAN",
                serviceCode: "n/a",
                lineName: "n/a",
                extraColumns: {
                    "Stop Name": "Stop 2",
                    "Stop Point Ref": "SP2",
                },
            },
        ]);
    });

    it("should return an empty array if stops have to correct stop type and exist in NaPTAN", () => {
        const naptanStopMap: NaptanStopMap = {
            SP1: {
                stopType: "BCT",
                regions: [],
            },
            SP2: {
                stopType: "BCT",
                regions: [],
            },
            SP4: {
                stopType: "BCT",
                regions: [],
            },
        };

        expect(checkStopsAgainstNaptan(mockValidData, naptanStopMap)).toEqual([]);
    });

    it("should return an empty array if there are no stops listed in TxC", () => {
        const naptanStopMap: NaptanStopMap = {
            SP1: {
                stopType: "BCT",
                regions: [],
            },
            SP2: {
                stopType: "BCT",
                regions: [],
            },
            SP4: {
                stopType: "BCT",
                regions: [],
            },
        };

        expect(
            checkStopsAgainstNaptan(
                { TransXChange: { ...mockValidData.TransXChange, StopPoints: undefined } },
                naptanStopMap,
            ),
        ).toEqual([]);
    });

    it("should return an empty array if stop exists in NaPTAN but there is no stop type in NaPTAN", () => {
        const naptanStopMap: NaptanStopMap = {
            SP1: {
                stopType: null,
                regions: [],
            },
            SP2: {
                stopType: null,
                regions: [],
            },
            SP4: {
                stopType: "BCT",
                regions: [],
            },
        };

        expect(checkStopsAgainstNaptan(mockValidData, naptanStopMap)).toEqual([]);
    });
});
