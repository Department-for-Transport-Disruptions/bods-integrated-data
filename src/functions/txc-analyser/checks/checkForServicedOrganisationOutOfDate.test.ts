import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/txc-analysis/schema";
import MockDate from "mockdate";
import { PartialDeep } from "type-fest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import checkForServicedOrganisationOutOfDate from "./checkForServicedOrganisationOutOfDate";

describe("checkForServicedOrganisationOutOfDate", () => {
    beforeAll(() => {
        MockDate.set("2025-01-07T00:00:00.000Z");
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should return an empty array if there are no serviced organisations", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                ServicedOrganisations: {
                    ServicedOrganisation: [],
                },
            },
        };

        const result = checkForServicedOrganisationOutOfDate(data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if the serviced organisation is up to date", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                ServicedOrganisations: {
                    ServicedOrganisation: [
                        {
                            OrganisationCode: "servicedOrg1",
                            Name: "Test Organisation 1",
                            WorkingDays: [
                                {
                                    DateRange: [{ EndDate: "2025-01-08" }, { EndDate: "2025-01-09" }],
                                },
                            ],
                        },
                    ],
                },
            },
        } as unknown as PartialDeep<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate(data);
        expect(result).toEqual([]);
    });

    it("should return an observation if the serviced organisation is out of date", () => {
        const data: PartialDeep<TxcSchema> = {
            TransXChange: {
                ServicedOrganisations: {
                    ServicedOrganisation: [
                        {
                            OrganisationCode: "servicedOrg1",
                            Name: "Test Organisation 1",
                            WorkingDays: [
                                {
                                    DateRange: [{ EndDate: "2025-01-06" }, { EndDate: "2025-01-05" }],
                                },
                            ],
                        },
                        {
                            OrganisationCode: "",
                            WorkingDays: [
                                {
                                    DateRange: [{ EndDate: "2025-01-05" }, { EndDate: "2025-01-04" }],
                                },
                            ],
                        },
                    ],
                },
            },
        } as unknown as PartialDeep<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate(data);
        expect(result).toEqual<Observation[]>([
            {
                importance: "advisory",
                category: "dataset",
                observation: "Serviced organisation data is out of date",
                serviceCode: "n/a",
                lineName: "n/a",
                latestEndDate: "20250106",
                details:
                    "The Working Days for Serviced Organisation Test Organisation 1 (servicedOrg1) has expired on 06/01/2025. Please update the dates for this Serviced Organisation.",
            },
            {
                importance: "advisory",
                category: "dataset",
                observation: "Serviced organisation data is out of date",
                serviceCode: "n/a",
                lineName: "n/a",
                latestEndDate: "20250105",
                details:
                    "The Working Days for Serviced Organisation unknown name (unknown code) has expired on 05/01/2025. Please update the dates for this Serviced Organisation.",
            },
        ]);
    });
});
