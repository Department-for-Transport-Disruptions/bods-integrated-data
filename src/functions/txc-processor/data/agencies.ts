import { Database, NewAgency } from "@bods-integrated-data/shared/database";
import { Operator } from "@bods-integrated-data/shared/schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { getAgency, getOperator, insertAgency } from "./database";

export const processAgencies = async (dbClient: Kysely<Database>, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const existingAgency = await getAgency(dbClient, operator.NationalOperatorCode);
        const existingNoc = await getOperator(dbClient, operator.NationalOperatorCode);

        const newAgency: NewAgency = {
            name: existingNoc?.operator_public_name ?? operator.OperatorShortName,
            noc: operator.NationalOperatorCode,
            url: "https://www.traveline.info",
            phone: "",
        };

        return insertAgency(dbClient, existingAgency || newAgency);
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};
