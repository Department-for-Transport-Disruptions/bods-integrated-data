import { Agency, Database, NewAgency } from "@bods-integrated-data/shared/database";
import { Operator } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertAgencies } from "./agencies";
import * as databaseFunctions from "./database";

describe("agencies", () => {
    let dbClient: Kysely<Database>;
    const getAgencyMock = vi.spyOn(databaseFunctions, "getAgency");
    const getOperatorMock = vi.spyOn(databaseFunctions, "getOperator");
    const insertAgencyMock = vi.spyOn(databaseFunctions, "insertAgency");

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("inserts agencies into the database and returns them", async () => {
        const operators: Operator[] = [
            {
                "@_id": "1",
                NationalOperatorCode: "noc1",
                OperatorShortName: "name1",
            },
            {
                "@_id": "2",
                NationalOperatorCode: "noc2",
                OperatorShortName: "name2",
            },
        ];

        const expectedAgencies: NewAgency[] = [
            {
                name: "name1",
                noc: "noc1",
                url: "https://www.traveline.info",
                phone: "",
            },
            {
                name: "name2",
                noc: "noc2",
                url: "https://www.traveline.info",
                phone: "",
            },
        ];

        getAgencyMock.mockResolvedValue(undefined);
        getOperatorMock.mockResolvedValue(undefined);
        insertAgencyMock.mockImplementation((_dbClient, agency) => Promise.resolve(agency) as Promise<Agency>);

        const result = await insertAgencies(dbClient, operators);
        expect(result).toEqual(expectedAgencies);
    });

    it("inserts agencies into the database and returns them with updated names when existing NOCs are referenced", async () => {
        const operators: Operator[] = [
            {
                "@_id": "1",
                NationalOperatorCode: "noc1",
                OperatorShortName: "name1",
            },
            {
                "@_id": "2",
                NationalOperatorCode: "noc2",
                OperatorShortName: "name2",
            },
        ];

        const expectedAgencies: NewAgency[] = [
            {
                name: "name3",
                noc: "noc1",
                url: "https://www.traveline.info",
                phone: "",
            },
            {
                name: "name3",
                noc: "noc2",
                url: "https://www.traveline.info",
                phone: "",
            },
        ];

        getAgencyMock.mockResolvedValue(undefined);
        getOperatorMock.mockResolvedValue({
            noc: "noc3",
            operator_public_name: "name3",
            vosa_psv_license_name: "",
            op_id: "",
            pub_nm_id: "",
        });
        insertAgencyMock.mockImplementation((_dbClient, agency) => Promise.resolve(agency) as Promise<Agency>);

        const result = await insertAgencies(dbClient, operators);
        expect(result).toEqual(expectedAgencies);
    });

    it("doesn't insert agencies that already exist in the database", async () => {
        const operators: Operator[] = [
            {
                "@_id": "1",
                NationalOperatorCode: "noc1",
                OperatorShortName: "name1",
            },
            {
                "@_id": "2",
                NationalOperatorCode: "noc2",
                OperatorShortName: "name2",
            },
        ];

        const expectedAgencies: NewAgency[] = [
            {
                id: 3,
                name: "name3",
                noc: "noc3",
                url: "https://www.traveline.info",
                phone: "",
                timezone: "",
                lang: "",
            },
            {
                name: "name2",
                noc: "noc2",
                url: "https://www.traveline.info",
                phone: "",
            },
        ];

        getAgencyMock.mockResolvedValueOnce({
            id: 3,
            name: "name3",
            noc: "noc3",
            url: "https://www.traveline.info",
            phone: "",
            timezone: "",
            lang: "",
        });
        getAgencyMock.mockResolvedValueOnce(undefined);
        getOperatorMock.mockResolvedValue(undefined);
        insertAgencyMock.mockImplementation((_dbClient, agency) => Promise.resolve(agency) as Promise<Agency>);

        const result = await insertAgencies(dbClient, operators);
        expect(result).toEqual(expectedAgencies);
    });
});
