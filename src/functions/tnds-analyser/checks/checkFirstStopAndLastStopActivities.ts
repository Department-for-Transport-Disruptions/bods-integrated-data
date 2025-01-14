import { JourneyPattern, JourneyPatternSections, TxcSchema } from "@bods-integrated-data/shared/schema";
import {
    allowedFirstStopActivity,
    allowedLastStopActivity,
} from "@bods-integrated-data/shared/tnds-analyser/constants";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";

const checkFirstStopIsSetDownOnly = (
    journeyPattern: JourneyPattern,
    journeyPatternSections: JourneyPatternSections,
) => {
    const firstSectionRef = journeyPattern.JourneyPatternSectionRefs[0];

    const firstJourneyPatternSection = journeyPatternSections.JourneyPatternSection?.find(
        (journeyPatternSection) => journeyPatternSection["@_id"] === firstSectionRef,
    );

    if (firstJourneyPatternSection) {
        const firstStopActivity = firstJourneyPatternSection.JourneyPatternTimingLink[0].From?.Activity;

        const firstStopPointRef = firstJourneyPatternSection.JourneyPatternTimingLink[0].From?.StopPointRef;

        return {
            firstStopIsSetDownOnly: !allowedFirstStopActivity.includes(firstStopActivity ?? ""),
            firstStopPointRef: firstStopPointRef,
        };
    }

    return { firstStopIsSetDownOnly: true, firstStopPointRef: undefined };
};

const checkLastStopIsPickUpOnly = (journeyPattern: JourneyPattern, journeyPatternSections: JourneyPatternSections) => {
    const lastSectionRef =
        journeyPattern.JourneyPatternSectionRefs[journeyPattern.JourneyPatternSectionRefs.length - 1];

    const lastJourneyPatternSection = journeyPatternSections.JourneyPatternSection?.find(
        (journeyPatternSection) => journeyPatternSection["@_id"] === lastSectionRef,
    );

    if (lastJourneyPatternSection) {
        const lastStopActivity =
            lastJourneyPatternSection.JourneyPatternTimingLink[
                lastJourneyPatternSection.JourneyPatternTimingLink.length - 1
            ].To?.Activity;

        const lastStopPointRef =
            lastJourneyPatternSection.JourneyPatternTimingLink[
                lastJourneyPatternSection.JourneyPatternTimingLink.length - 1
            ].To?.StopPointRef;

        return {
            lastStopIsPickUpOnly: !allowedLastStopActivity.includes(lastStopActivity ?? ""),
            lastStopPointRef: lastStopPointRef,
        };
    }

    return { lastStopIsPickUpOnly: true, lastStopPointRef: undefined };
};

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            let lineName = "n/a";
            let direction = "unknown direction";
            let lastStopCommonName = "n/a";
            let firstStopCommonName = "n/a";

            const departureTime = vehicleJourney.DepartureTime || "unknown departure time";
            const journeyPatternRef = vehicleJourney.JourneyPatternRef;

            if (journeyPatternRef) {
                const services = txcData.TransXChange?.Services;
                const journeyPatternSections = txcData.TransXChange?.JourneyPatternSections;

                if (services && journeyPatternSections) {
                    const service = services.Service?.find(
                        (service) => service.ServiceCode === vehicleJourney.ServiceRef,
                    );

                    if (service) {
                        const line = service.Lines.Line.find((line) => line["@_id"] === vehicleJourney.LineRef);

                        if (line) {
                            lineName = line.LineName;
                        }

                        const journeyPattern = service.StandardService.JourneyPattern.find(
                            (journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef,
                        );

                        if (journeyPattern?.Direction) {
                            direction = journeyPattern.Direction;
                        }

                        if (
                            journeyPattern?.JourneyPatternSectionRefs &&
                            journeyPattern?.JourneyPatternSectionRefs.length > 0
                        ) {
                            const { firstStopIsSetDownOnly, firstStopPointRef } = checkFirstStopIsSetDownOnly(
                                journeyPattern,
                                journeyPatternSections,
                            );

                            if (firstStopIsSetDownOnly) {
                                if (firstStopPointRef) {
                                    const firstStopPoint =
                                        txcData.TransXChange?.StopPoints?.AnnotatedStopPointRef?.find(
                                            (stopPoint) => stopPoint.StopPointRef === firstStopPointRef,
                                        );
                                    if (firstStopPoint) {
                                        firstStopCommonName = firstStopPoint.CommonName;
                                    }
                                }

                                observations.push({
                                    importance: "advisory",
                                    category: "stop",
                                    observation: "First stop is set down only",
                                    service: lineName,
                                    details: `The first stop (${firstStopCommonName}) on the ${departureTime} ${direction} journey is incorrectly set to set down passengers.`,
                                });
                            }

                            const { lastStopIsPickUpOnly, lastStopPointRef } = checkLastStopIsPickUpOnly(
                                journeyPattern,
                                journeyPatternSections,
                            );

                            if (lastStopIsPickUpOnly) {
                                if (lastStopPointRef) {
                                    const lastStopPoint = txcData.TransXChange?.StopPoints?.AnnotatedStopPointRef?.find(
                                        (stopPoint) => stopPoint.StopPointRef === lastStopPointRef,
                                    );
                                    if (lastStopPoint) {
                                        lastStopCommonName = lastStopPoint.CommonName;
                                    }
                                }

                                observations.push({
                                    importance: "advisory",
                                    category: "stop",
                                    observation: "Last stop is pick up only",
                                    service: lineName,
                                    details: `The last stop (${lastStopCommonName}) on the ${departureTime} ${direction} journey is incorrectly set to pick up passengers.`,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return observations;
};
