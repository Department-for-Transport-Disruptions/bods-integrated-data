import { describe, expect, it } from "vitest";
import { getFirstNonZeroDuration } from "./utils";

describe("utils", () => {
    describe("getFirstNonZeroDuration", () => {
        it("returns undefined when there are no durations", () => {
            const result = getFirstNonZeroDuration([]);
            expect(result).toBeUndefined();
        });

        it("returns undefined when all durations are zero", () => {
            const result = getFirstNonZeroDuration(["PT0S", "PT0M", "PT0H"]);
            expect(result).toBeUndefined();
        });

        it.each([
            [["PT1S", "PT0M", "PT0H"], "PT1S"],
            [["PT0S", "PT1M", "PT0H"], "PT1M"],
            [["PT0S", "PT0M", "PT1H"], "PT1H"],
        ])("returns the non-zero duration when at least one exists", (input, expected) => {
            const result = getFirstNonZeroDuration(input);
            expect(result?.toISOString()).toEqual(expected);
        });
    });
});
