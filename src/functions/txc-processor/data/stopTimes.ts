import { KyselyDb, NewStopTime } from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";
import { TxcJourneyPatternSection } from "@bods-integrated-data/shared/schema";
import { VehicleJourneyMapping } from "../types";
import { mapTimingLinksToStopTimes } from "../utils";
import { insertStopTimes, updateTripWithOriginAndDestinationRef } from "./database";

export const processStopTimes = async (
    dbClient: KyselyDb,
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const tripOriginDestinationMap: {
        tripId: string;
        originStopRef: string | null;
        destinationStopRef: string | null;
    }[] = [];

    const stopTimes = vehicleJourneyMappings.flatMap<NewStopTime>((vehicleJourneyMapping) => {
        const { tripId, vehicleJourney, journeyPattern } = vehicleJourneyMapping;

        if (!journeyPattern) {
            logger.warn(`Unable to find journey pattern for vehicle journey with line ref: ${vehicleJourney.LineRef}`);
            return [];
        }

        const journeyPatternTimingLinks = journeyPattern.JourneyPatternSectionRefs.flatMap((ref) => {
            const journeyPatternSection = txcJourneyPatternSections.find((section) => section["@_id"] === ref);

            if (!journeyPatternSection) {
                logger.warn(`Unable to find journey pattern section with journey pattern section ref: ${ref}`);
                return [];
            }

            return journeyPatternSection.JourneyPatternTimingLink;
        });

        const stopTimes = mapTimingLinksToStopTimes(tripId, vehicleJourney, journeyPatternTimingLinks);

        tripOriginDestinationMap.push({
            tripId: tripId,
            originStopRef: stopTimes[0]?.stop_id ?? null,
            destinationStopRef: stopTimes.length > 1 ? stopTimes.at(-1)?.stop_id ?? null : null,
        });

        return stopTimes;
    });

    if (stopTimes.length > 0) {
        await insertStopTimes(dbClient, stopTimes);

        for (const tripMapping of tripOriginDestinationMap) {
            await updateTripWithOriginAndDestinationRef(
                dbClient,
                tripMapping.tripId,
                tripMapping.originStopRef,
                tripMapping.destinationStopRef,
            );
        }
    }
};
