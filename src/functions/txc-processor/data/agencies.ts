import { KyselyDb, NewAgency } from "@bods-integrated-data/shared/database";
import { Operator } from "@bods-integrated-data/shared/schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { InvalidOperatorError } from "../errors";
import { getNationalOperatorCode } from "../utils";
import { getAgency, getOperator, insertAgency } from "./database";

export const processAgencies = async (dbClient: KyselyDb, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const noc = getNationalOperatorCode(operator);

        if (!noc) {
            throw new InvalidOperatorError();
        }

        const existingAgency = await getAgency(dbClient, noc);

        if (existingAgency) {
            return existingAgency;
        }

        const existingNoc = await getOperator(dbClient, noc);

        const newAgency: NewAgency = {
            name: existingNoc?.operator_public_name ?? operator.OperatorShortName,
            noc: noc.toUpperCase(),
            url: "https://www.traveline.info",
            phone: "",
        };

        return insertAgency(dbClient, newAgency);
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};
