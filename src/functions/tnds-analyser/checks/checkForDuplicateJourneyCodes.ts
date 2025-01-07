import { randomUUID } from "node:crypto";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";

export default (filename: string, data: Partial<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = data.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        const vehicleJourneyCodes: string[] = [];
        const duplicateVehicleJourneyCodes: string[] = [];

        for (const vehicleJourney of vehicleJourneys) {
            if (vehicleJourney.VehicleJourneyCode) {
                if (
                    vehicleJourneyCodes.includes(vehicleJourney.VehicleJourneyCode) &&
                    !duplicateVehicleJourneyCodes.includes(vehicleJourney.VehicleJourneyCode)
                ) {
                    duplicateVehicleJourneyCodes.push(vehicleJourney.VehicleJourneyCode);

                    let serviceCode = "n/a";
                    let lineName = "n/a";
                    const services = data.TransXChange?.Services;

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
                        PK: filename,
                        SK: randomUUID(),
                        importance: "critical",
                        category: "journey",
                        observation: "Duplicate journey code",
                        registrationNumber: serviceCode,
                        service: lineName,
                        details: `The Journey Code (${vehicleJourney.VehicleJourneyCode}) is found in more than one vehicle journey.`,
                    });
                }

                vehicleJourneyCodes.push(vehicleJourney.VehicleJourneyCode);
            }
        }
    }

    return observations;
};
