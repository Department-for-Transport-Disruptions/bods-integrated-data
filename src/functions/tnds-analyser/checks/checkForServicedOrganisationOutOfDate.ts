import { randomUUID } from "node:crypto";
import { getDate } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";

export default (filename: string, data: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const services = data.TransXChange?.Services?.Service;

    if (services) {
        for (const service of services) {
            const servicedOrganisationRefs =
                service.OperatingProfile?.ServicedOrganisationDayType?.DaysOfOperation?.WorkingDays
                    ?.ServicedOrganisationRef;

            if (servicedOrganisationRefs) {
                for (const servicedOrganisationRef of servicedOrganisationRefs) {
                    const servicedOrganisation = data.TransXChange?.ServicedOrganisations?.ServicedOrganisation?.find(
                        (servicedOrganisation) => servicedOrganisation.OrganisationCode === servicedOrganisationRef,
                    );

                    const dateRanges = servicedOrganisation?.WorkingDays?.DateRange;

                    if (dateRanges) {
                        const sortedEndDates = dateRanges.map(([, endDate]) => endDate).sort((a, b) => a.diff(b));
                        const latestEndDate = sortedEndDates[sortedEndDates.length - 1];
                        const today = getDate().startOf("day");

                        if (latestEndDate.isBefore(today)) {
                            const serviceName = servicedOrganisation.Name || "unknown";
                            const endDate = latestEndDate.format("YYYY-MM-DD");

                            observations.push({
                                PK: filename,
                                SK: randomUUID(),
                                importance: "advisory",
                                category: "dataset",
                                observation: "Serviced organisation out of date",
                                registrationNumber: service.ServiceCode,
                                service: "n/a",
                                details: `The Working Days for Serviced Organisation ${serviceName} (${servicedOrganisationRef}) has expired on ${endDate}. Please update the dates for this Serviced Organisation.`,
                            });
                        }
                    }
                }
            }
        }
    }

    return observations;
};
