import { describe, expect, it } from "vitest";
import { enumSchema, getMappedEnumValue } from "./utils";

describe("schema util tests", () => {
    enum TestEnum {
        firstValue = "firstValue",
        secondValue = "secondValue",
    }

    describe("getMappedEnumValue", () => {
        it.each([
            ["firstValue", "firstValue"],
            ["firstvalue", "firstValue"],
            ["FirstValue", "firstValue"],
            ["FIRSTVALUE", "firstValue"],
            ["FiRsTvAlUe", "firstValue"],
            ["firstValue2", "firstValue2"],
            ["", ""],
        ])("correctly maps an enum", (value, result) => {
            expect(getMappedEnumValue(TestEnum, value)).toEqual(result);
        });
    });

    describe("enumSchema", () => {
        it.each([
            ["firstValue", true, undefined],
            ["firstvalue", true, undefined],
            ["FirstValue", true, undefined],
            ["FIRSTVALUE", true, undefined],
            ["FiRsTvAlUe", true, undefined],
            ["firstValue2", false, "Invalid enum value. Expected 'firstValue' | 'secondValue', received 'firstValue2'"],
            ["", false, "Invalid enum value. Expected 'firstValue' | 'secondValue', received ''"],
        ])("correctly validates case-insensitive enum values", (value, isSuccessful, errorMessage) => {
            const parseResult = enumSchema(TestEnum).safeParse(value);
            expect(parseResult.success).toEqual(isSuccessful);
            expect(parseResult.error?.errors[0].message).toEqual(errorMessage);
        });
    });
});
