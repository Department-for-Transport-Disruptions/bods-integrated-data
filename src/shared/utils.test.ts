import { describe, expect, it } from "vitest";
import { RouteType, WheelchairAccessibility } from "./database";
import { getDate } from "./dates";
import { AvlSubscription, VehicleType } from "./schema";
import {
    checkSubscriptionIsHealthy,
    chunkArray,
    getRouteTypeFromServiceMode,
    getWheelchairAccessibilityFromVehicleType,
    isPrivateAddress,
    notEmpty,
} from "./utils";

describe("shared utils", () => {
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
                    VehicleEquipment: { WheelchairEquipment: { NumberOfWheelchairAreas: 1 } },
                },
                "bus",
            ],
            [{ WheelchairAccessible: true }, "bus"],
        ])(
            "should return Accessible if mode is underground, WheelchairAccessible is true, or NumberOfWheelchairs is greater than zero ",
            (vehicleType?: VehicleType, mode?: string) => {
                expect(getWheelchairAccessibilityFromVehicleType(vehicleType, mode)).toStrictEqual(
                    WheelchairAccessibility.Accessible,
                );
            },
        );
        it.each([
            [{ WheelchairAccessible: false }, "bus"],
            [
                {
                    VehicleEquipment: { WheelchairEquipment: { NumberOfWheelchairAreas: 0 } },
                },
                "bus",
            ],
        ])(
            "should return NotAccessible if WheelchairAccessible is false, or if NumberOfWheelchairs is equal to zero ",
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
                    VehicleEquipment: { WheelchairAccessible: undefined, WheelchairEquipment: undefined },
                },
                "bus",
            ],
        ])(
            "should return NoAccessibilityInformation if VehicleType is undefined or if WheelchairAccessible or WheelchairEquipment is undefined,",
            (vehicleType?: VehicleType, mode?: string) => {
                expect(getWheelchairAccessibilityFromVehicleType(vehicleType, mode)).toStrictEqual(
                    WheelchairAccessibility.NoAccessibilityInformation,
                );
            },
        );
    });

    describe("getRouteTypeFromServiceMode", () => {
        it.each([
            ["bus", RouteType.Bus],
            ["coach", RouteType.Coach],
            ["ferry", RouteType.Ferry],
            ["metro", RouteType.Metro],
            ["rail", RouteType.Rail],
            ["tram", RouteType.Tram],
            ["trolleyBus", RouteType.TrolleyBus],
            ["underground", RouteType.Underground],
        ])("maps TXC service mode to GTFS route type", (mode, routeType) => {
            expect(getRouteTypeFromServiceMode(mode)).toEqual(routeType);
        });

        it.each([[""], [undefined]])("maps missing service mode to GTFS route type bus", (mode) => {
            expect(getRouteTypeFromServiceMode(mode)).toEqual(RouteType.Bus);
        });
    });

    describe("isPrivateAddress", () => {
        it.each([
            ["192.168.0.1", true],
            ["172.19.4.56:8080", true],
            ["http://10.0.1.4/hello", true],
            ["http://34.0.7.43/123", false],
            ["https://test.example.com", false],
        ])("returns true if address is private", (address: string, isPrivate: boolean) => {
            expect(isPrivateAddress(address)).toBe(isPrivate);
        });
    });

    describe("checkSubscriptionHealthy", () => {
        const subscription: AvlSubscription = {
            apiKey: "123",
            PK: "abc-def",
            description: "Test",
            publisherId: "Test",
            shortDescription: "Test",
            status: "live",
            url: "https://test.example.com",
        };
        const currentTime = getDate();

        it.each<[Partial<AvlSubscription>, boolean]>([
            [{}, false],
            [{ heartbeatLastReceivedDateTime: currentTime.subtract(20, "seconds").toISOString() }, true],
            [{ lastResubscriptionTime: currentTime.subtract(80, "seconds").toISOString() }, true],
            [{ serviceStartDatetime: currentTime.subtract(90, "seconds").toISOString() }, true],
            [
                {
                    lastAvlDataReceivedDateTime: currentTime.subtract(30, "seconds").toISOString(),
                    heartbeatLastReceivedDateTime: currentTime.subtract(140, "seconds").toISOString(),
                },
                true,
            ],
            [
                {
                    lastAvlDataReceivedDateTime: currentTime.subtract(130, "seconds").toISOString(),
                    heartbeatLastReceivedDateTime: currentTime.subtract(240, "seconds").toISOString(),
                },
                false,
            ],
        ])("correctly determines if a subscription is healthy", (data, isHealthy) => {
            expect(
                checkSubscriptionIsHealthy(
                    currentTime,
                    { ...subscription, ...data },
                    data?.lastAvlDataReceivedDateTime,
                ),
            ).toBe(isHealthy);
        });
    });
});
