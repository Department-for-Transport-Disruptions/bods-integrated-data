import { describe, expect, it } from "vitest";
import { TflIBusData } from "./db";
import { generateStopPoints } from "./stop-points";

describe("generateStopPoints", () => {
    it("generates unique stop points from patterns", () => {
        const patterns = [
            {
                stops: [
                    { atco_code: "12345", common_name: "Stop A" },
                    { atco_code: "67890", common_name: "Stop B" },
                ],
            },
            {
                stops: [
                    { atco_code: "12345", common_name: "Stop A" }, // duplicate
                    { atco_code: "54321", common_name: "Stop C" },
                ],
            },
        ];

        const result = generateStopPoints(patterns as TflIBusData["patterns"]);

        expect(result.AnnotatedStopPointRef).toEqual([
            { StopPointRef: "12345", CommonName: "Stop A" },
            { StopPointRef: "67890", CommonName: "Stop B" },
            { StopPointRef: "54321", CommonName: "Stop C" },
        ]);
    });
});
