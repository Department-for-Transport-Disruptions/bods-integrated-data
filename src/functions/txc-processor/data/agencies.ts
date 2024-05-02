import { Database, NewAgency } from "@bods-integrated-data/shared/database";
import { Operator } from "@bods-integrated-data/shared/schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { getAgency, getOperator, insertAgency } from "./database";
import { InvalidOperatorError } from "../errors";
import { getNationalOperatorCode } from "../utils";

export const processAgencies = async (dbClient: Kysely<Database>, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const noc = getNationalOperatorCode(operator);

        if (!noc) {
            throw new InvalidOperatorError();
        }

        const existingAgency = await getAgency(dbClient, noc);
        const existingNoc = await getOperator(dbClient, noc);

        const newAgency: NewAgency = {
            name: existingNoc?.operator_public_name ?? operator.OperatorShortName,
            noc,
            url: "https://www.traveline.info",
            phone: "",
        };

        return insertAgency(dbClient, existingAgency || newAgency);
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};
