import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { logger } from "@baselime/lambda-logger";
import { Database, getDatabaseClient } from "@bods-integrated-data/shared";
import { Kysely, sql } from "kysely";

const lambdaClient = new LambdaClient({ region: "eu-west-2" });

const cleardownDatabase = async (dbClient: Kysely<Database>) => {
    const tables: (keyof Database)[] = ["agency", "route", "shape"];

    for (const table of tables) {
        await dbClient.schema.dropTable(`${table}_new`).ifExists().execute();

        await sql`CREATE TABLE ${sql.table(`${table}_new`)} (LIKE ${sql.table(table)} INCLUDING ALL)`.execute(dbClient);
    }
};

export const handler = async () => {
    logger.info("Starting TXC Retriever");

    try {
        const {
            BODS_TXC_RETRIEVER_FUNCTION_NAME: bodsTxcRetrieverFunctionName,
            TNDS_TXC_RETRIEVER_FUNCTION_NAME: tndsTxcRetrieverFunctionName,
            IS_LOCAL: isLocal = "false",
        } = process.env;

        if (!bodsTxcRetrieverFunctionName) {
            throw new Error("Missing env vars: BODS_RETRIEVER_FUNCTION_NAME required");
        }

        if (!tndsTxcRetrieverFunctionName) {
            throw new Error("Missing env vars: TNDS_TXC_RETRIEVER_FUNCTION_NAME required");
        }

        const dbClient = await getDatabaseClient(isLocal === "true");
        await cleardownDatabase(dbClient);

        logger.info("Invoking BODS Retriever Function");

        await lambdaClient.send(
            new InvokeCommand({
                FunctionName: bodsTxcRetrieverFunctionName,
                InvocationType: InvocationType.Event,
            }),
        );

        await lambdaClient.send(
            new InvokeCommand({
                FunctionName: tndsTxcRetrieverFunctionName,
                InvocationType: InvocationType.Event,
            }),
        );
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Error running the TXC Retriever", e);
        }

        throw e;
    }
};
