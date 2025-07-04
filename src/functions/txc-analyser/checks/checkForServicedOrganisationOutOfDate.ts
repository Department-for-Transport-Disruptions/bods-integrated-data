import { TXC_REPORT_DATE_FORMAT } from "@bods-integrated-data/shared/constants";
import { getDate } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import { PartialDeep } from "type-fest";

export default (txcData: PartialDeep<TxcSchema>): Observation[] => {
    const observations: Observation[] = [];
    const servicedOrganisations = txcData.TransXChange?.ServicedOrganisations?.ServicedOrganisation;

    if (servicedOrganisations) {
        for (const servicedOrganisation of servicedOrganisations) {
            const organisationCode = servicedOrganisation.OrganisationCode || "unknown code";
            const workingDays = servicedOrganisation?.WorkingDays;

            if (workingDays) {
                for (const workingDay of workingDays) {
                    const dateRanges = workingDay.DateRange;
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
                            const endDate = latestEndDate.format(TXC_REPORT_DATE_FORMAT);

                            observations.push({
                                importance: "advisory",
                                category: "dataset",
                                observation: "Serviced organisation data is out of date",
                                serviceCode: "n/a",
                                lineName: "n/a",
                                latestEndDate: endDate,
                                details: `The Working Days for Serviced Organisation ${serviceName} (${organisationCode}) has expired on ${endDate}. Please update the dates for this Serviced Organisation.`,
                            });
                        }
                    }
                }
            }
        }
    }

    return observations;
};
