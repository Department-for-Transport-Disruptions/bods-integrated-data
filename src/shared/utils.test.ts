import { describe, expect, it } from "vitest";
import { chunkArray } from ".";

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
