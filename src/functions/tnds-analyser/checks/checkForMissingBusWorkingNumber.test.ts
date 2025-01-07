import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { describe, expect, it, vi } from "vitest";
import checkForMissingBusWorkingNumber from "./checkForMissingBusWorkingNumber";
import { mockInvalidData, mockValidData } from "./mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("checkForMissingBusWorkingNumber", () => {
    const filename = "test-file";
    it("should return an observation if a vehicle journey is missing a bus working number", () => {
        expect(checkForMissingBusWorkingNumber(filename, mockInvalidData)).toEqual<Observation[]>([
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "advisory",
                category: "journey",
                observation: "Missing bus working number",
                registrationNumber: "SVC1",
                service: "Line 1",
                details: "The (08:00) outbound journey has not been assigned a bus working number (i.e. block number).",
            },
        ]);
    });

    it("should return an empty array if a vehicle journey contains a bus working number", () => {
        expect(checkForMissingBusWorkingNumber(filename, mockValidData)).toEqual([]);
    });
});
