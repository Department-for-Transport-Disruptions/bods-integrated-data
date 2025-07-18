import { TXC_REPORT_DATE_FORMAT } from "@bods-integrated-data/shared/constants";
import { getDate } from "@bods-integrated-data/shared/dates";
import { JourneyPattern, JourneyPatternSections, TxcSchema } from "@bods-integrated-data/shared/schema";
import { allowedTimingPointValues } from "@bods-integrated-data/shared/txc-analysis/constants";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
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

        const firstStopPointRef =
            firstJourneyPatternSection.JourneyPatternTimingLink[0].From?.StopPointRef?.toUpperCase();

        return {
            firstStopIsTimingPoint: allowedTimingPointValues.includes(firstStopTimingStatus ?? ""),
            firstStopPointRef: firstStopPointRef,
        };
    }

    return { firstStopIsTimingPoint: false, firstStopPointRef: undefined };
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
            ].To?.StopPointRef?.toUpperCase();

        return {
            lastStopIsTimingPoint: allowedTimingPointValues.includes(lastStopTimingStatus ?? ""),
            lastStopPointRef: lastStopPointRef,
        };
    }

    return { lastStopIsTimingPoint: false, lastStopPointRef: undefined };
};

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            let serviceCode = "n/a";
            let lineName = "n/a";
            let direction = "unknown direction";
            let lastStopCommonName = "n/a";
            let firstStopCommonName = "n/a";
            let latestEndDate = "n/a";

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
                        serviceCode = service.ServiceCode;

                        if (service.OperatingPeriod.EndDate) {
                            latestEndDate = getDate(service.OperatingPeriod.EndDate).format(TXC_REPORT_DATE_FORMAT);
                        }

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
                            const { firstStopIsTimingPoint, firstStopPointRef } = checkFirstStopIsTimingPoint(
                                journeyPattern,
                                journeyPatternSections,
                            );

                            if (!firstStopIsTimingPoint) {
                                if (firstStopPointRef) {
                                    const firstStopPoint =
                                        txcData.TransXChange?.StopPoints?.AnnotatedStopPointRef?.find(
                                            (stopPoint) => stopPoint.StopPointRef.toUpperCase() === firstStopPointRef,
                                        );
                                    if (firstStopPoint) {
                                        firstStopCommonName = firstStopPoint.CommonName;
                                    }
                                }

                                observations.push({
                                    importance: "critical",
                                    category: "timing",
                                    observation: "First stop is not a timing point",
                                    serviceCode,
                                    lineName,
                                    latestEndDate,
                                    details: `The first stop (${firstStopCommonName}) on the ${departureTime} ${direction} journey is not set as a timing point.`,
                                    extraColumns: {
                                        "Stop Name": firstStopCommonName,
                                        "Departure time": departureTime,
                                        Direction: direction,
                                    },
                                });
                            }

                            const { lastStopIsTimingPoint, lastStopPointRef } = checkLastStopIsTimingPoint(
                                journeyPattern,
                                journeyPatternSections,
                            );

                            if (!lastStopIsTimingPoint) {
                                if (lastStopPointRef) {
                                    const lastStopPoint = txcData.TransXChange?.StopPoints?.AnnotatedStopPointRef?.find(
                                        (stopPoint) => stopPoint.StopPointRef.toUpperCase() === lastStopPointRef,
                                    );
                                    if (lastStopPoint) {
                                        lastStopCommonName = lastStopPoint.CommonName;
                                    }
                                }

                                observations.push({
                                    importance: "critical",
                                    category: "timing",
                                    observation: "Last stop is not a timing point",
                                    serviceCode,
                                    lineName,
                                    latestEndDate,
                                    details: `The last stop (${lastStopCommonName}) on the ${departureTime} ${direction} journey is not set as a timing point.`,
                                    extraColumns: {
                                        "Stop Name": lastStopCommonName,
                                        "Departure time": departureTime,
                                        Direction: direction,
                                    },
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
