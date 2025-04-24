import { KyselyDb, NewAgency } from "@bods-integrated-data/shared/database";
import { Operator } from "@bods-integrated-data/shared/schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import { InvalidOperatorError } from "../errors";
import { getNationalOperatorCode } from "../utils";
import { getAgency, getOperator, insertAgency } from "./database";
import { logger } from "@bods-integrated-data/shared/logger";

export const processAgencies = async (dbClient: KyselyDb, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const noc = getNationalOperatorCode(operator);

        if (!noc) {
            throw new InvalidOperatorError();
        }
        logger.info(`Getting existing agencies for noc: ${noc.trim()}`);

        const existingAgency = await getAgency(dbClient, noc.trim());

        if (existingAgency) {
            return existingAgency;
        }

        logger.info("Getting existing operators");
        const existingNoc = await getOperator(dbClient, noc);

        const newAgency: NewAgency = {
            name: existingNoc?.operator_public_name ?? operator.OperatorShortName,
            noc: noc.toUpperCase(),
            url: "https://www.traveline.info",
            phone: "",
        };

        logger.info("Inserting into agency DB");

        await insertAgency(dbClient, newAgency);

        logger.info("Successfully inserted into agency DB");

        return;
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};
