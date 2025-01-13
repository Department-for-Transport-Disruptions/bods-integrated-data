import { getDate } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { PartialDeep } from "type-fest";

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const servicedOrganisations = txcData.TransXChange?.ServicedOrganisations?.ServicedOrganisation;

    if (servicedOrganisations) {
        for (const servicedOrganisation of servicedOrganisations) {
            const organisationCode = servicedOrganisation.OrganisationCode || "unknown code";
            const dateRanges = servicedOrganisation?.WorkingDays?.DateRange;

            if (dateRanges) {
                // A typecast is needed because the TxcSchema transforms the DateRange, which we don't want
                const sortedEndDates = (dateRanges as unknown as { EndDate?: string }[])
                    .filter((dateRange) => dateRange.EndDate)
                    .map((dateRange) => getDate(dateRange.EndDate))
                    .sort((a, b) => a.diff(b));

                const latestEndDate = sortedEndDates[sortedEndDates.length - 1];
                const today = getDate().startOf("day");

                if (latestEndDate.isBefore(today)) {
                    const serviceName = servicedOrganisation.Name || "unknown name";
                    const endDate = latestEndDate.format("YYYY-MM-DD");

                    observations.push({
                        PK: "",
                        SK: "",
                        timeToExist: 0,
                        dataSource: "",
                        noc: "",
                        region: "",
                        importance: "advisory",
                        category: "dataset",
                        observation: "Serviced organisation out of date",
                        registrationNumber: "n/a",
                        service: "n/a",
                        details: `The Working Days for Serviced Organisation ${serviceName} (${organisationCode}) has expired on ${endDate}. Please update the dates for this Serviced Organisation.`,
                    });
                }
            }
        }
    }

    return observations;
};
