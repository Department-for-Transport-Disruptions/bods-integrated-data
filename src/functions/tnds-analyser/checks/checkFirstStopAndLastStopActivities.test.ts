import { describe, expect, it, vi } from "vitest";
import checkFirstStopAndLastStopActivities from "./checkFirstStopAndLastStopActivities";
import { mockInvalidData, mockValidData } from "./mockData";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("checkFirstStopAndLastStopActivities", () => {
    const filename = "test-file";
    it("should return observations if first stop and last stop have incorrect activity", () => {
        const expectedObservation = [
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "stop",
                details:
                    "The first stop (Stop 1) on the 08:00 outbound journey is incorrectly set to set down passengers.",
                importance: "advisory",
                observation: "First stop is set down only",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
            {
                PK: filename,
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                category: "stop",
                details:
                    "The last stop (Stop 2) on the 08:00 outbound journey is incorrectly set to pick up passengers.",
                importance: "advisory",
                observation: "Last stop is pick up only",
                registrationNumber: "SVC1",
                service: "Line 1",
            },
        ];
        expect(checkFirstStopAndLastStopActivities(filename, mockInvalidData)).toEqual(expectedObservation);
    });

    it("should return an empty array if a first stop and last stop have correct activity", () => {
        expect(checkFirstStopAndLastStopActivities(filename, mockValidData)).toEqual([]);
    });
});
