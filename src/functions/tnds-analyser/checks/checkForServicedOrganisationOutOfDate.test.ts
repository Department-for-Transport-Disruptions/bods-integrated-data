import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import MockDate from "mockdate";
import { PartialDeep } from "type-fest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import checkForServicedOrganisationOutOfDate from "./checkForServicedOrganisationOutOfDate";

vi.mock("node:crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

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

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
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
                            WorkingDays: {
                                DateRange: [{ EndDate: "2025-01-08" }, { EndDate: "2025-01-09" }],
                            },
                        },
                    ],
                },
            },
        } as unknown as PartialDeep<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
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
                            WorkingDays: {
                                DateRange: [{ EndDate: "2025-01-06" }, { EndDate: "2025-01-05" }],
                            },
                        },
                        {
                            OrganisationCode: "",
                            WorkingDays: {
                                DateRange: [{ EndDate: "2025-01-05" }, { EndDate: "2025-01-04" }],
                            },
                        },
                    ],
                },
            },
        } as unknown as PartialDeep<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
        expect(result).toEqual<Observation[]>([
            {
                PK: "testfile.xml",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "advisory",
                category: "dataset",
                observation: "Serviced organisation out of date",
                registrationNumber: "n/a",
                service: "n/a",
                details:
                    "The Working Days for Serviced Organisation Test Organisation 1 (servicedOrg1) has expired on 2025-01-06. Please update the dates for this Serviced Organisation.",
            },
            {
                PK: "testfile.xml",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "advisory",
                category: "dataset",
                observation: "Serviced organisation out of date",
                registrationNumber: "n/a",
                service: "n/a",
                details:
                    "The Working Days for Serviced Organisation unknown name (unknown code) has expired on 2025-01-05. Please update the dates for this Serviced Organisation.",
            },
        ]);
    });
});
