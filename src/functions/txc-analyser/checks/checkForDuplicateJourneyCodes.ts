import { TXC_REPORT_DATE_FORMAT } from "@bods-integrated-data/shared/constants";
import { getDate } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import { PartialDeep } from "type-fest";

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        const journeyCodes: string[] = [];
        const duplicateJourneyCodes: string[] = [];

        for (const vehicleJourney of vehicleJourneys) {
            const journeyCode = vehicleJourney.Operational?.TicketMachine?.JourneyCode;

            if (journeyCode) {
                if (journeyCodes.includes(journeyCode) && !duplicateJourneyCodes.includes(journeyCode)) {
                    duplicateJourneyCodes.push(journeyCode);

                    let serviceCode = "n/a";
                    let lineName = "n/a";
                    let latestEndDate = "n/a";
                    const services = txcData.TransXChange?.Services;

                    if (services) {
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
                        }
                    }

                    observations.push({
                        importance: "advisory",
                        category: "journey",
                        observation: "Duplicate journey code",
                        serviceCode,
                        lineName,
                        latestEndDate,
                        details: `The Journey Code (${journeyCode}) is found in more than one vehicle journey.`,
                    });
                }

                journeyCodes.push(journeyCode);
            }
        }
    }

    return observations;
};
