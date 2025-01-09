import { randomUUID } from "node:crypto";
import { JourneyPattern, JourneyPatternSections, TxcSchema } from "@bods-integrated-data/shared/schema";
import { allowedTimingPointValues } from "@bods-integrated-data/shared/tnds-analyser/constants";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";

const checkFirstStopIsTimingPoint = (
    journeyPattern: JourneyPattern,
    journeyPatternSections: JourneyPatternSections,
) => {
    const firstSectionRef = journeyPattern.JourneyPatternSectionRefs[0];

    const firstJourneyPatternSection = journeyPatternSections.JourneyPatternSection?.find(
        (journeyPatternSection) => journeyPatternSection["@_id"] === firstSectionRef,
    );

    if (firstJourneyPatternSection) {
        const firstStopTimingStatus = firstJourneyPatternSection.JourneyPatternTimingLink[0].From?.TimingStatus;

        const firstStopPointRef = firstJourneyPatternSection.JourneyPatternTimingLink[0].From?.StopPointRef;

        return {
            firstStopIsTimingPoint: allowedTimingPointValues.includes(firstStopTimingStatus ?? ""),
            firstStopPointRef: firstStopPointRef,
        };
    }

    return { firstStopIsTimingPoint: true, firstStopPointRef: undefined };
};

const checkLastStopIsTimingPoint = (journeyPattern: JourneyPattern, journeyPatternSections: JourneyPatternSections) => {
    const lastSectionRef =
        journeyPattern.JourneyPatternSectionRefs[journeyPattern.JourneyPatternSectionRefs.length - 1];

    const lastJourneyPatternSection = journeyPatternSections.JourneyPatternSection?.find(
        (journeyPatternSection) => journeyPatternSection["@_id"] === lastSectionRef,
    );

    if (lastJourneyPatternSection) {
        const lastStopTimingStatus =
            lastJourneyPatternSection.JourneyPatternTimingLink[
                lastJourneyPatternSection.JourneyPatternTimingLink.length - 1
            ].To?.TimingStatus;

        const lastStopPointRef =
            lastJourneyPatternSection.JourneyPatternTimingLink[
                lastJourneyPatternSection.JourneyPatternTimingLink.length - 1
            ].To?.StopPointRef;

        return {
            lastStopIsTimingPoint: allowedTimingPointValues.includes(lastStopTimingStatus ?? ""),
            lastStopPointRef: lastStopPointRef,
        };
    }

    return { lastStopIsTimingPoint: true, lastStopPointRef: undefined };
};

export default (filename: string, data: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = data.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            let serviceCode = "n/a";
            let lineName = "n/a";
            let direction = "";
            let lastStopCommonName = "n/a";
            let firstStopCommonName = "n/a";

            const departureTime = vehicleJourney.DepartureTime || "unknown departure time";
            const journeyPatternRef = vehicleJourney.JourneyPatternRef;

            if (journeyPatternRef) {
                const services = data.TransXChange?.Services;
                const journeyPatternSections = data.TransXChange?.JourneyPatternSections;

                if (services && journeyPatternSections) {
                    const service = services.Service?.find(
                        (service) => service.ServiceCode === vehicleJourney.ServiceRef,
                    );

                    if (service) {
                        serviceCode = service.ServiceCode;
                        const line = service.Lines.Line.find((line) => line["@_id"] === vehicleJourney.LineRef);

                        if (line) {
                            lineName = line.LineName;
                        }

                        const journeyPattern = service.StandardService.JourneyPattern.find(
                            (journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef,
                        );

                        if (journeyPattern?.Direction) {
                            direction = `${journeyPattern.Direction} `;
                        }

                        if (
                            journeyPattern?.JourneyPatternSectionRefs &&
                            journeyPattern?.JourneyPatternSectionRefs.length > 0
                        ) {
                            const { firstStopIsTimingPoint, firstStopPointRef } = checkFirstStopIsTimingPoint(
                                journeyPattern,
                                journeyPatternSections,
                            );

                            if (!firstStopIsTimingPoint) {
                                if (firstStopPointRef) {
                                    const firstStopPoint = data.TransXChange?.StopPoints?.AnnotatedStopPointRef?.find(
                                        (stopPoint) => stopPoint.StopPointRef === firstStopPointRef,
                                    );
                                    if (firstStopPoint) {
                                        firstStopCommonName = firstStopPoint.CommonName;
                                    }
                                }

                                observations.push({
                                    PK: filename,
                                    SK: randomUUID(),
                                    importance: "critical",
                                    category: "timing",
                                    observation: "First stop is not a timing point",
                                    registrationNumber: serviceCode,
                                    service: lineName,
                                    details: `The first stop (${firstStopCommonName}) on the ${departureTime} ${direction}journey is not set as a timing point.`,
                                });
                            }

                            const { lastStopIsTimingPoint, lastStopPointRef } = checkLastStopIsTimingPoint(
                                journeyPattern,
                                journeyPatternSections,
                            );

                            if (!lastStopIsTimingPoint) {
                                if (lastStopPointRef) {
                                    const lastStopPoint = data.TransXChange?.StopPoints?.AnnotatedStopPointRef?.find(
                                        (stopPoint) => stopPoint.StopPointRef === lastStopPointRef,
                                    );
                                    if (lastStopPoint) {
                                        lastStopCommonName = lastStopPoint.CommonName;
                                    }
                                }

                                observations.push({
                                    PK: filename,
                                    SK: randomUUID(),
                                    importance: "critical",
                                    category: "timing",
                                    observation: "Last stop is not a timing point",
                                    registrationNumber: serviceCode,
                                    service: lineName,
                                    details: `The last stop (${lastStopCommonName}) on the ${departureTime} ${direction}journey is not set as a timing point.`,
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
