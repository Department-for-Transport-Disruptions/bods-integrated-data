import { describe, expect, it } from "vitest";
import { chunkArray, notEmpty } from ".";

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
