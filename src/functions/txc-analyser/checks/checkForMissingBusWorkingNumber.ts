import { DEFAULT_DATE_FORMAT } from "@bods-integrated-data/shared/constants";
import { getDate } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import { PartialDeep } from "type-fest";

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            if (!vehicleJourney.Operational?.Block?.BlockNumber) {
                let serviceCode = "n/a";
                let lineName = "n/a";
                let direction = "unknown direction";
                let latestEndDate = "n/a";

                const departureTime = vehicleJourney.DepartureTime || "unknown departure time";
                const services = txcData.TransXChange?.Services;

                if (services) {
                    const service = services.Service?.find(
                        (service) => service.ServiceCode === vehicleJourney.ServiceRef,
                    );

                    if (service) {
                        serviceCode = service.ServiceCode;

                        if (service.OperatingPeriod.EndDate) {
                            latestEndDate = getDate(service.OperatingPeriod.EndDate).format(DEFAULT_DATE_FORMAT);
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
                    }
                }

                observations.push({
                    importance: "advisory",
                    category: "journey",
                    observation: "Missing bus working number",
                    serviceCode,
                    lineName,
                    latestEndDate,
                    details: `The (${departureTime}) ${direction} journey has not been assigned a bus working number (i.e. block number).`,
                });
            }
        }
    }

    return observations;
};
