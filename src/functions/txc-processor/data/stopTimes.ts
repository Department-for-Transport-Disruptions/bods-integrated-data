import { logger } from "@baselime/lambda-logger";
import { Database, NewStopTime } from "@bods-integrated-data/shared/database";
import { Service, TxcJourneyPatternSection } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { insertStopTimes } from "./database";
import { VehicleJourneyMapping } from "../types";
import { mapTimingLinksToStopTimes } from "../utils";

export const processStopTimes = async (
    dbClient: Kysely<Database>,
    services: Service[],
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    vehicleJourneyMappings: VehicleJourneyMapping[],
) => {
    const stopTimes = vehicleJourneyMappings.flatMap<NewStopTime>((vehicleJourneyMapping) => {
        const { tripId, vehicleJourney } = vehicleJourneyMapping;

        const journeyPattern = services
            .flatMap((s) => s.StandardService.JourneyPattern)
            .find((journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef);

        if (!journeyPattern) {
            logger.warn(`Unable to find journey pattern with journey pattern ref: ${vehicleJourney.JourneyPatternRef}`);
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
