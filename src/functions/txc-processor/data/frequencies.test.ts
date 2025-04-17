import { Frequency, KyselyDb, NewFrequency, ServiceType } from "@bods-integrated-data/shared/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleJourneyMapping } from "../types";
import * as databaseFunctions from "./database";
import { processFrequencies } from "./frequencies";

describe("frequencies", () => {
    const dbClient = vi.fn() as unknown as KyselyDb;
    const insertFrequenciesMock = vi.spyOn(databaseFunctions, "insertFrequencies");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("inserts frequencies into the database and returns them", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "4",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    LineRef: "5",
                    ServiceRef: "6",
                    JourneyPatternRef: "7",
                    VehicleJourneyCode: "8",
                    DepartureTime: "00:00:00",
                    Frequency: {
                        EndTime: "00:00:30",
                        Interval: {
                            ScheduledFrequency: "PT2M",
                        },
                    },
                },
            },
            {
                routeId: 11,
                serviceId: 12,
                shapeId: "13",
                tripId: "14",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    LineRef: "15",
                    ServiceRef: "16",
                    JourneyPatternRef: "17",
                    VehicleJourneyCode: "18",
                    DepartureTime: "00:01:00",
                    Frequency: {
                        EndTime: "00:01:15",
                    },
                },
            },
        ];

        const expectedFrequencies: NewFrequency[] = [
            {
                trip_id: "4",
                start_time: "00:00:00",
                end_time: "00:00:30",
                headway_secs: 120,
                exact_times: ServiceType.FrequencyBased,
            },
            {
                trip_id: "14",
                start_time: "00:01:00",
                end_time: "00:01:15",
                headway_secs: 0,
                exact_times: ServiceType.ScheduleBased,
            },
        ];

        insertFrequenciesMock.mockImplementation(
            (_dbClient, frequencies) => Promise.resolve(frequencies) as Promise<Frequency[]>,
        );

        await processFrequencies(dbClient, vehicleJourneyMappings);
        expect(insertFrequenciesMock).toHaveBeenCalledWith(dbClient, expectedFrequencies);
    });

    it("doesn't insert frequencies that are missing a Frequency definition", async () => {
        const vehicleJourneyMappings: VehicleJourneyMapping[] = [
            {
                routeId: 1,
                serviceId: 2,
                shapeId: "3",
                tripId: "4",
                blockId: "",
                serviceCode: "test",
                vehicleJourney: {
                    LineRef: "5",
                    ServiceRef: "6",
                    JourneyPatternRef: "7",
                    VehicleJourneyCode: "8",
                    DepartureTime: "00:00:00",
                },
            },
        ];

        await processFrequencies(dbClient, vehicleJourneyMappings);
        expect(insertFrequenciesMock).not.toHaveBeenCalled();
    });
});
