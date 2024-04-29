import { Database, NewFrequency, ServiceType } from "@bods-integrated-data/shared/database";
import { getDuration } from "@bods-integrated-data/shared/dates";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { insertFrequencies } from "./database";
import { VehicleJourneyMapping } from "../types";

export const processFrequencies = async (
    dbClient: Kysely<Database>,
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const frequencies = vehicleJourneyMappings
        .map<NewFrequency | null>((vehicleJourneyMapping) => {
            const { vehicleJourney } = vehicleJourneyMapping;

            if (!vehicleJourney.Frequency) {
                return null;
            }

            let headwaySecs = 0;
            let exactTimes = ServiceType.ScheduleBased;

            if (vehicleJourney.Frequency.Interval?.ScheduledFrequency) {
                headwaySecs = getDuration(vehicleJourney.Frequency.Interval.ScheduledFrequency).asSeconds();

                if (vehicleJourney.Frequency.EndTime) {
                    exactTimes = ServiceType.FrequencyBased;
                }
            }

            return {
                trip_id: vehicleJourneyMapping.tripId,
                start_time: vehicleJourney.DepartureTime,
                end_time: vehicleJourney.Frequency.EndTime,
                headway_secs: headwaySecs,
                exact_times: exactTimes,
            };
        })
        .filter(notEmpty);

    return insertFrequencies(dbClient, frequencies);
};
