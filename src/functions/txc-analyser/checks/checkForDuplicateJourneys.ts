import { OperatingProfile, TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import hash from "object-hash";
import { PartialDeep } from "type-fest";

type VehicleJourneyMapping = {
    DepartureTime: string;
    RouteRef: string;
    OperatingProfile: OperatingProfile;
};

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const vehicleJourneys = txcData.TransXChange?.VehicleJourneys?.VehicleJourney;

    if (vehicleJourneys) {
        const vehicleJourneyHashes: string[] = [];
        const duplicateVehicleJourneyHashes: string[] = [];

        for (const vehicleJourney of vehicleJourneys) {
            let serviceCode = "n/a";
            let lineName = "n/a";
            const services = txcData.TransXChange?.Services;

            if (services) {
                const service = services.Service?.find((service) => service.ServiceCode === vehicleJourney.ServiceRef);
                const operatingProfile = vehicleJourney.OperatingProfile || service?.OperatingProfile;

                if (service && operatingProfile) {
                    serviceCode = service.ServiceCode;
                    const line = service.Lines.Line.find((line) => line["@_id"] === vehicleJourney.LineRef);

                    if (line) {
                        lineName = line.LineName;
                    }

                    const journeyPatternRef = vehicleJourney.JourneyPatternRef || vehicleJourney.VehicleJourneyRef;

                    if (journeyPatternRef) {
                        const routeRef = service.StandardService.JourneyPattern.find(
                            (journeyPattern) => journeyPattern["@_id"] === journeyPatternRef,
                        )?.RouteRef;

                        if (routeRef) {
                            const vehicleJourneyMapping: VehicleJourneyMapping = {
                                DepartureTime: vehicleJourney.DepartureTime,
                                RouteRef: routeRef,
                                OperatingProfile: operatingProfile,
                            };
                            const vehicleJourneyHash = hash(vehicleJourneyMapping);

                            if (
                                vehicleJourneyHashes.includes(vehicleJourneyHash) &&
                                !duplicateVehicleJourneyHashes.includes(vehicleJourneyHash)
                            ) {
                                duplicateVehicleJourneyHashes.push(vehicleJourneyHash);

                                observations.push({
                                    importance: "advisory",
                                    category: "journey",
                                    observation: "Duplicate journey",
                                    serviceCode,
                                    lineName,
                                    details: `The journey (with code ${vehicleJourney.VehicleJourneyCode}) has the same departure time, route and operating profile as another journey.`,
                                });
                            }

                            vehicleJourneyHashes.push(vehicleJourneyHash);
                        }
                    }
                }
            }
        }
    }

    return observations;
};
