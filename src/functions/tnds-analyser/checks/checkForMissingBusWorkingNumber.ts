import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        for (const vehicleJourney of vehicleJourneys) {
            if (!vehicleJourney.Operational?.Block?.BlockNumber) {
                let serviceCode = "n/a";
                let lineName = "n/a";
                let direction = "";
                const departureTime = vehicleJourney.DepartureTime || "unknown departure time";
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

                        const journeyPattern = service.StandardService.JourneyPattern.find(
                            (journeyPattern) => journeyPattern["@_id"] === vehicleJourney.JourneyPatternRef,
                        );

                        if (journeyPattern?.Direction) {
                            direction = `${journeyPattern.Direction} `;
                        }
                    }
                }

                observations.push({
                    PK: "",
                    SK: "",
                    timeToExist: 0,
                    dataSource: "",
                    noc: "",
                    region: "",
                    importance: "advisory",
                    category: "journey",
                    observation: "Missing bus working number",
                    registrationNumber: serviceCode,
                    service: lineName,
                    details: `The (${departureTime}) ${direction}journey has not been assigned a bus working number (i.e. block number).`,
                });
            }
        }
    }

    return observations;
};
