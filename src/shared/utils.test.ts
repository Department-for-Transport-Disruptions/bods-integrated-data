import { describe, expect, it } from "vitest";
import { WheelchairAccessibility } from "./database";
import { VehicleType } from "./schema";
import { chunkArray, getWheelchairAccessibilityFromVehicleType, notEmpty } from "./utils";

describe("chunkArray", () => {
    it.each([
        [
            [1, 2, 3, 4, 5, 6],
            2,
            [
                [1, 2],
                [3, 4],
                [5, 6],
            ],
        ],
        [
            [1, 2, 3, 4, 5, 6],
            3,
            [
                [1, 2, 3],
                [4, 5, 6],
            ],
        ],
        [[1, 2, 3, 4, 5, 6], 5, [[1, 2, 3, 4, 5], [6]]],
        [[1, 2, 3, 4, 5, 6], 7, [[1, 2, 3, 4, 5, 6]]],
    ])(
        "correctly chunks an array into segments of the given size",
        (array: number[], chunkSize: number, expected: number[][]) => {
            expect(chunkArray(array, chunkSize)).toStrictEqual(expected);
        },
    );
});

describe("notEmpty", () => {
    it("removes null and undefined elements from an array", () => {
        const array = [1, 2, null, 3, undefined, 4];

        expect(array.filter(notEmpty)).toEqual([1, 2, 3, 4]);
    });
});

describe("getWheelchairAccessibilityFromVehicleType", () => {
    it.each([
        [undefined, "underground"],
        [
            {
                VehicleEquipment: { WheelchairEquipment: { NumberOfWheelChairAreas: 1 } },
            },
            "bus",
        ],
        [{ WheelChairAccessible: true }, "bus"],
    ])(
        "should return Accessible if mode is underground, WheelChairAccessible is true, or NumberOfWheelChairs is greater than zero ",
        (vehicleType?: VehicleType, mode?: string) => {
            expect(getWheelchairAccessibilityFromVehicleType(vehicleType, mode)).toStrictEqual(
                WheelchairAccessibility.Accessible,
            );
        },
    );
    it.each([
        [{ WheelChairAccessible: false }, "bus"],
        [
            {
                VehicleEquipment: { WheelchairEquipment: { NumberOfWheelChairAreas: 0 } },
            },
            "bus",
        ],
    ])(
        "should return NotAccessible if WheelChairAccessible is false, or if NumberOfWheelChairs is equal to zero ",
        (vehicleType?: VehicleType, mode?: string) => {
            expect(getWheelchairAccessibilityFromVehicleType(vehicleType, mode)).toStrictEqual(
                WheelchairAccessibility.NotAccessible,
            );
        },
    );
    it.each([
        [undefined, "bus"],
        [
            {
                VehicleEquipment: { WheelChairAccessible: undefined, WheelchairEquipment: undefined },
            },
            "bus",
        ],
    ])(
        "should return NoAccessibilityInformation if VehicleType is undefined or if WheelChairAccessible or WheelChairEquipment is undefined,",
        (vehicleType?: VehicleType, mode?: string) => {
            expect(getWheelchairAccessibilityFromVehicleType(vehicleType, mode)).toStrictEqual(
                WheelchairAccessibility.NoAccessibilityInformation,
            );
        },
    );
});
