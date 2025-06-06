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
                    const services = txcData.TransXChange?.Services;

                    if (services) {
                        const service = services.Service?.find(
                            (service) => service.ServiceCode === vehicleJourney.ServiceRef,
                        );

                        if (service) {
                            serviceCode = service.ServiceCode;
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
                        details: `The Journey Code (${journeyCode}) is found in more than one vehicle journey.`,
                    });
                }

                journeyCodes.push(journeyCode);
            }
        }
    }

    return observations;
};
