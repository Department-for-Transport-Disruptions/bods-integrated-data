import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { describe, expect, it, vi } from "vitest";
import checkStopsAgainstNaptan from "./checkStopsAgainstNaptan";
import { mockInvalidData, mockValidData } from "./mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("checkStopsAgainstNaptan", () => {
    const filename = "test-file";

    it("should return an observation if a vehicle journey is missing a bus working number", () => {
        const naptanData = {
            SP1: "WRONG",
        };
        expect(checkStopsAgainstNaptan(filename, mockInvalidData, naptanData)).toEqual<Observation[]>([
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "stop",
                details:
                    "The Stop 1 (SP1) stop is registered as stop type WRONG with NaPTAN. Expected bus stop types are BCT,BCQ,BCS,BCE,BST.",
                importance: "critical",
                observation: "Incorrect stop type",
                registrationNumber: "n/a",
                service: "n/a",
            },
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "stop",
                details:
                    "The Stop 2 (SP2) stop is not registered with NaPTAN. Please check the ATCO code is correct or contact your local authority to register this stop with NaPTAN.",
                importance: "advisory",
                observation: "Stop not found in NaPTAN",
                registrationNumber: "n/a",
                service: "n/a",
            },
        ]);
    });

    it("should return an empty array if stops have to correct stop type and exist in NaPTAN", () => {
        const naptanData = {
            SP1: "BCT",
            SP2: "BCT",
        };

        expect(checkStopsAgainstNaptan(filename, mockValidData, naptanData)).toEqual([]);
    });
});
