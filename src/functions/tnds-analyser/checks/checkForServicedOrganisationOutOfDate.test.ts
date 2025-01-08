import { getDate } from "@bods-integrated-data/shared/dates";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import MockDate from "mockdate";
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

    it("should return an empty array if there are no services", () => {
        const data: Partial<TxcSchema> = {
            TransXChange: {
                Services: {
                    Service: [],
                },
            },
        };

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if there are no serviced organisation references", () => {
        const now = getDate();
        const data: Partial<TxcSchema> = {
            TransXChange: {
                Services: {
                    Service: [
                        {
                            ServiceCode: "service1",
                            OperatingProfile: {
                                ServicedOrganisationDayType: {
                                    DaysOfOperation: {
                                        WorkingDays: {
                                            ServicedOrganisationRef: ["servicedOrg1"],
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
                ServicedOrganisations: {
                    ServicedOrganisation: [
                        {
                            OrganisationCode: "servicedOrg2",
                            Name: "Test Organisation 1",
                            WorkingDays: {
                                DateRange: [
                                    [now.subtract(2, "day"), now.add(1, "day")],
                                    [now.subtract(1, "day"), now.add(2, "day")],
                                ],
                            },
                        },
                    ],
                },
            },
        } as Partial<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return an empty array if the serviced organisation is up to date", () => {
        const now = getDate();
        const data: Partial<TxcSchema> = {
            TransXChange: {
                Services: {
                    Service: [
                        {
                            ServiceCode: "service1",
                            OperatingProfile: {
                                ServicedOrganisationDayType: {
                                    DaysOfOperation: {
                                        WorkingDays: {
                                            ServicedOrganisationRef: ["servicedOrg1"],
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
                ServicedOrganisations: {
                    ServicedOrganisation: [
                        {
                            OrganisationCode: "servicedOrg1",
                            Name: "Test Organisation 1",
                            WorkingDays: {
                                DateRange: [
                                    [now.subtract(2, "day"), now.add(1, "day")],
                                    [now.subtract(1, "day"), now.add(2, "day")],
                                ],
                            },
                        },
                    ],
                },
            },
        } as Partial<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
        expect(result).toEqual([]);
    });

    it("should return an observation if the serviced organisation is out of date", () => {
        const now = getDate();
        const data: Partial<TxcSchema> = {
            TransXChange: {
                Services: {
                    Service: [
                        {
                            ServiceCode: "service1",
                            OperatingProfile: {
                                ServicedOrganisationDayType: {
                                    DaysOfOperation: {
                                        WorkingDays: {
                                            ServicedOrganisationRef: ["servicedOrg1"],
                                        },
                                    },
                                },
                            },
                        },
                        {
                            ServiceCode: "service2",
                            OperatingProfile: {
                                ServicedOrganisationDayType: {
                                    DaysOfOperation: {
                                        WorkingDays: {
                                            ServicedOrganisationRef: ["servicedOrg2"],
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
                ServicedOrganisations: {
                    ServicedOrganisation: [
                        {
                            OrganisationCode: "servicedOrg1",
                            Name: "Test Organisation 1",
                            WorkingDays: {
                                DateRange: [
                                    [now.subtract(20, "day"), now.subtract(1, "day")],
                                    [now.subtract(10, "day"), now.subtract(9, "day")],
                                ],
                            },
                        },
                        {
                            OrganisationCode: "servicedOrg2",
                            WorkingDays: {
                                DateRange: [
                                    [now.subtract(20, "day"), now.subtract(2, "day")],
                                    [now.subtract(10, "day"), now.subtract(9, "day")],
                                ],
                            },
                        },
                    ],
                },
            },
        } as Partial<TxcSchema>;

        const result = checkForServicedOrganisationOutOfDate("testfile.xml", data);
        expect(result).toEqual<Observation[]>([
            {
                PK: "testfile.xml",
                SK: "5965q7gh-5428-43e2-a75c-1782a48637d5",
                importance: "advisory",
                category: "dataset",
                observation: "Serviced organisation out of date",
                registrationNumber: "service1",
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
                registrationNumber: "service2",
                service: "n/a",
                details:
                    "The Working Days for Serviced Organisation unknown (servicedOrg2) has expired on 2025-01-05. Please update the dates for this Serviced Organisation.",
            },
        ]);
    });
});
