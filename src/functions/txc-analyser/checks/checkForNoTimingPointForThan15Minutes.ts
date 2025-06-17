import { TXC_REPORT_DATE_FORMAT } from "@bods-integrated-data/shared/constants";
import { getDate, getDuration } from "@bods-integrated-data/shared/dates";
import { AbstractTimingLink, TxcSchema } from "@bods-integrated-data/shared/schema";
import { allowedTimingPointValues } from "@bods-integrated-data/shared/txc-analysis/constants";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import { PartialDeep } from "type-fest";

const fifteenMinutesInSeconds = 15 * 60;

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const services = txcData.TransXChange?.Services;
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;
    const journeyPatternTimingLinks =
        txcData.TransXChange?.JourneyPatternSections?.JourneyPatternSection?.flatMap(
            (section) => section.JourneyPatternTimingLink || [],
        ) || [];

    const journeyPatternTimingLinksMap: Record<string, AbstractTimingLink> = {};

    for (const journeyPatternTimingLink of journeyPatternTimingLinks) {
        if (journeyPatternTimingLink["@_id"]) {
            journeyPatternTimingLinksMap[journeyPatternTimingLink["@_id"]] = journeyPatternTimingLink;
        }
    }

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            let serviceCode = "n/a";
            let lineName = "n/a";
            let latestEndDate = "n/a";

            const service = services?.Service?.find((service) => service.ServiceCode === vehicleJourney.ServiceRef);

            if (service) {
                serviceCode = service.ServiceCode;

                if (service.OperatingPeriod.EndDate) {
                    latestEndDate = getDate(service.OperatingPeriod.EndDate).format(TXC_REPORT_DATE_FORMAT);
                }

                const line = service.Lines.Line.find((line) => line["@_id"] === vehicleJourney.LineRef);

                if (line) {
                    lineName = line.LineName;
                }
            }

            const vehicleJourneyTimingLinks = vehicleJourney.VehicleJourneyTimingLink || [];
            let currentRunTime = 0;
            let startJourneyPatternTimingLinkId = "";
            let endJourneyPatternTimingLinkId = "";

            for (const vehicleJourneyTimingLink of vehicleJourneyTimingLinks) {
                const timingLink = journeyPatternTimingLinksMap[vehicleJourneyTimingLink.JourneyPatternTimingLinkRef];

                if (timingLink) {
                    if (allowedTimingPointValues.includes(timingLink.From?.TimingStatus || "")) {
                        currentRunTime = 0;
                        startJourneyPatternTimingLinkId = vehicleJourneyTimingLink.JourneyPatternTimingLinkRef;
                    }

                    if (vehicleJourneyTimingLink.RunTime) {
                        currentRunTime += getDuration(vehicleJourneyTimingLink.RunTime).asSeconds();
                    } else if (timingLink.RunTime) {
                        currentRunTime += getDuration(timingLink.RunTime).asSeconds();
                    }

                    if (allowedTimingPointValues.includes(timingLink.To?.TimingStatus || "")) {
                        endJourneyPatternTimingLinkId = vehicleJourneyTimingLink.JourneyPatternTimingLinkRef;

                        if (currentRunTime > fifteenMinutesInSeconds) {
                            observations.push({
                                importance: "advisory",
                                category: "timing",
                                observation: "No timing point for more than 15 minutes",
                                serviceCode,
                                lineName,
                                latestEndDate,
                                details: `Service ${lineName} has at least one journey with a pair of timings of more than 15 minutes`,
                                extraColumns: {
                                    "Start Timing Link ID": startJourneyPatternTimingLinkId,
                                    "End Timing Link ID": endJourneyPatternTimingLinkId,
                                    "Run Time": getDuration(currentRunTime, "seconds").toISOString(),
                                },
                            });
                        }
                    }
                }
            }
        }
    }

    return observations;
};
