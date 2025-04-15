import { KyselyDb, LocationType, NewStop, NewStopTime } from "@bods-integrated-data/shared/database";
import { checkCalendarsOverlap } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { TxcJourneyPatternSection } from "@bods-integrated-data/shared/schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { VehicleJourneyMappingWithCalendar, VehicleJourneyMappingWithTimes } from "../types";
import { mapTimingLinksToStopTimes } from "../utils";
import { insertStopTimes, updateTripWithOriginDestinationRefAndBlockId } from "./database";

export const processStopTimes = async (
    dbClient: KyselyDb,
    txcJourneyPatternSections: TxcJourneyPatternSection[],
    vehicleJourneyMappings: VehicleJourneyMappingWithCalendar[],
    insertedStopPoints: NewStop[],
) => {
    const tripOriginDestinationBlockIdMap: {
        tripId: string;
        originStopRef: string | null;
        destinationStopRef: string | null;
        blockId: string;
    }[] = [];

    const updatedVehicleJourneyMappings = structuredClone(vehicleJourneyMappings) as VehicleJourneyMappingWithTimes[];

    const stopTimes = vehicleJourneyMappings
        .flatMap<NewStopTime>((vehicleJourneyMapping, index) => {
            const { tripId, vehicleJourney, journeyPattern } = vehicleJourneyMapping;

            if (!journeyPattern) {
                logger.warn(
                    `Unable to find journey pattern for vehicle journey with line ref: ${vehicleJourney.LineRef}`,
                );
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

            if (!stopTimes.length) {
                logger.warn(`No stop times found for trip ID: ${tripId}`);
                return [];
            }

            const startTime = stopTimes[0].arrival_time;
            const endTime = stopTimes[stopTimes.length - 1].departure_time;

            const updatedVehicleJourneyMapping = updatedVehicleJourneyMappings[index];

            updatedVehicleJourneyMapping.startTime = startTime;
            updatedVehicleJourneyMapping.endTime = endTime;

            if (updatedVehicleJourneyMapping.blockId) {
                for (const vj of updatedVehicleJourneyMappings) {
                    if (
                        !vj.blockId ||
                        vehicleJourneyMapping.blockId !== vj.blockId ||
                        vehicleJourneyMapping.tripId === vj.tripId
                    ) {
                        continue;
                    }

                    const calendarsOverlap = checkCalendarsOverlap(
                        vehicleJourneyMapping.calendarWithDates,
                        vj.calendarWithDates,
                    );

                    if (!calendarsOverlap) {
                        continue;
                    }

                    if (startTime < vj.endTime && endTime > vj.startTime) {
                        updatedVehicleJourneyMapping.blockId = "";
                        vj.blockId = "";

                        const existingMapping = tripOriginDestinationBlockIdMap.find((t) => t.tripId === vj.tripId);

                        if (existingMapping) {
                            existingMapping.blockId = "";
                        }
                    }
                }
            }

            tripOriginDestinationBlockIdMap.push({
                tripId: tripId,
                originStopRef: stopTimes[0].stop_id,
                destinationStopRef: stopTimes[stopTimes.length - 1].stop_id,
                blockId: updatedVehicleJourneyMappings[index].blockId,
            });

            return stopTimes;
        })
        .map<NewStopTime | null>((stopTime) => {
            const stopPoint = insertedStopPoints.find((isp) => isp.id === stopTime.stop_id);

            if (!stopPoint) {
                return null;
            }

            return {
                ...stopTime,
                exclude: stopPoint?.location_type === LocationType.RealStationEntrance,
            };
        })
        .filter(notEmpty);

    if (stopTimes.length > 0) {
        await insertStopTimes(dbClient, stopTimes);

        for (const tripMapping of tripOriginDestinationBlockIdMap) {
            await updateTripWithOriginDestinationRefAndBlockId(
                dbClient,
                tripMapping.tripId,
                tripMapping.originStopRef,
                tripMapping.destinationStopRef,
                tripMapping.blockId,
            );
        }
    }
};
