import { getDuration, getLocalTime } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { allowedTimingPointValues } from "@bods-integrated-data/shared/tnds-analyser/constants";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";

export default (data: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = data.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            let serviceCode = "n/a";
            let lineName = "n/a";
            let direction = "";

            const departureTime = getLocalTime(vehicleJourney.DepartureTime);
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
                            const journeyPatternSectionRefs = journeyPattern.JourneyPatternSectionRefs;

                            const timingLinksForJourney =
                                data.TransXChange?.JourneyPatternSections?.JourneyPatternSection?.filter((section) =>
                                    journeyPatternSectionRefs.includes(section["@_id"]),
                                ).flatMap((section) => section.JourneyPatternTimingLink);

                            if (timingLinksForJourney && timingLinksForJourney.length > 0) {
                                const previousStop = {
                                    departureTime,
                                    commonName: timingLinksForJourney[0]?.From?.StopPointRef,
                                    stopPointRef: timingLinksForJourney[0]?.From?.StopPointRef,
                                };
                                let accumulatedTimeWithoutATimingPoint = 0;

                                for (const timingLink of timingLinksForJourney) {
                                    const runTimeDuration = getDuration(timingLink.RunTime || "PT0S").asSeconds();
                                    const waitTimeDuration = getDuration(timingLink.To?.WaitTime || "PT0S").asSeconds();

                                    const currentStopDepartureTime = previousStop.departureTime
                                        .add(runTimeDuration, "seconds")
                                        .add(waitTimeDuration, "seconds");

                                    const currentStop = {
                                        departureTime: currentStopDepartureTime,
                                        commonName: timingLink.To?.StopPointRef,
                                        stopPointRef: timingLink.To?.StopPointRef,
                                    };

                                    accumulatedTimeWithoutATimingPoint = allowedTimingPointValues.includes(
                                        timingLink.To?.TimingStatus ?? "",
                                    )
                                        ? 0
                                        : accumulatedTimeWithoutATimingPoint + runTimeDuration + waitTimeDuration;

                                    if (accumulatedTimeWithoutATimingPoint > 900) {
                                        observations.push({
                                            PK: "",
                                            SK: "",
                                            timeToExist: 0,
                                            dataSource: "",
                                            noc: "",
                                            region: "",
                                            importance: "advisory",
                                            category: "timing",
                                            observation: "No timing point for more than 15 minutes",
                                            registrationNumber: serviceCode,
                                            service: lineName,
                                            details: `The link between the ${previousStop.departureTime.format(
                                                "HH:mm:ss",
                                            )} ${previousStop.commonName} (${
                                                previousStop.stopPointRef
                                            }) and ${currentStopDepartureTime.format("HH:mm:ss")} ${
                                                currentStop.commonName
                                            } (${
                                                currentStop.stopPointRef
                                            }) timing point stops on the ${departureTime.format(
                                                "HH:mm:ss",
                                            )} ${direction}journey is more than 15 minutes apart. The Traffic Commissioner recommends services to have timing points no more than 15 minutes apart.`,
                                        });
                                    }

                                    previousStop.departureTime = currentStop.departureTime;
                                    previousStop.stopPointRef = currentStop.stopPointRef;
                                    previousStop.commonName = currentStop.commonName;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return observations;
};
