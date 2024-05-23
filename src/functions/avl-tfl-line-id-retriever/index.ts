import { logger } from "@baselime/lambda-logger";
import { KyselyDb, NewTflLine, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios from "axios";
import { TflLinesSchema } from "./tfl-line.schema";

export const getLineIds = async () => {
    const url = "https://api.tfl.gov.uk/Line/Mode/bus";

    try {
        const response = await axios.get<TflLinesSchema>(url);

        if (!response.data || Object.keys(response.data).length === 0) {
            throw new Error(`Did not receive any data from back TfL url: ${url}`);
        }

        return response.data.map((line) => ({ id: line.id }));
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`Error fetching TFL line IDs with URL ${url}`, error);
        }

        throw error;
    }
};

const insertLineIds = async (dbClient: KyselyDb, lineIds: NewTflLine[]) => {
    await dbClient.transaction().execute(async (trx) => {
        await trx.deleteFrom("tfl_line").execute();
        await trx.insertInto("tfl_line").values(lineIds).execute();
    });
};

export const handler = async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting retrieval of TfL Line IDs");

        const lineIds = await getLineIds();

        await insertLineIds(dbClient, lineIds);

        logger.info("TfL line ID retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving tfl line Id's", e);
        }

        throw e;
    }
};
