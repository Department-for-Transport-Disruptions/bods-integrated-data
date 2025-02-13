import { KyselyDb, NewTflLine, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import axios from "axios";
import { z } from "zod";
import { TflLinesSchema } from "./tfl-line.schema";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

export const getLineIds = async () => {
    const url = "https://api.tfl.gov.uk/Line/Mode/bus";

    try {
        const response = await axios.get<TflLinesSchema>(url);

        return response.data.map((line) => ({ id: line.id }));
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, `Error fetching TfL line IDs with URL ${url}`);
        }

        throw e;
    }
};

const insertLineIds = async (dbClient: KyselyDb, lineIds: NewTflLine[]) => {
    await dbClient.transaction().execute(async (trx) => {
        await trx.deleteFrom("tfl_line").execute();

        if (lineIds.length > 0) {
            await trx.insertInto("tfl_line").values(lineIds).execute();
        }
    });
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        logger.info("Starting retrieval of TfL Line IDs");

        const lineIds = await getLineIds();

        await insertLineIds(dbClient, lineIds);

        logger.info("TfL line ID retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving TfL line IDs");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
