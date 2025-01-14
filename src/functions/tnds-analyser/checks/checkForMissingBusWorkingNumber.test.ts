import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { describe, expect, it } from "vitest";
import checkForMissingBusWorkingNumber from "./checkForMissingBusWorkingNumber";
import { mockInvalidData, mockValidData } from "./mockData";

describe("checkForMissingBusWorkingNumber", () => {
    it("should return an observation if a vehicle journey is missing a bus working number", () => {
        expect(checkForMissingBusWorkingNumber(mockInvalidData)).toEqual<Observation[]>([
            {
                importance: "advisory",
                category: "journey",
                observation: "Missing bus working number",
                service: "Line 1",
                details:
                    "The (08:00:00) outbound journey has not been assigned a bus working number (i.e. block number).",
            },
        ]);
    });

    it("should return an empty array if a vehicle journey contains a bus working number", () => {
        expect(checkForMissingBusWorkingNumber(mockValidData)).toEqual([]);
    });
});
