import { logger } from "@baselime/lambda-logger";
import { KyselyDb, NewStopTime } from "@bods-integrated-data/shared/database";
import { TxcJourneyPatternSection } from "@bods-integrated-data/shared/schema";
import { VehicleJourneyMapping } from "../types";
import { mapTimingLinksToStopTimes } from "../utils";
import { insertStopTimes } from "./database";

export const processStopTimes = async (
    dbClient: KyselyDb,
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
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

        return mapTimingLinksToStopTimes(tripId, vehicleJourney, journeyPatternTimingLinks);
    });

    if (stopTimes.length > 0) {
        await insertStopTimes(dbClient, stopTimes);
    }
};
