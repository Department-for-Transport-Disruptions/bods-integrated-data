import { logger } from "@baselime/lambda-logger";
import { KyselyDb, NewTflLine, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios from "axios";

export const getLineIds = async () => {
    const url = "https://api.tfl.gov.uk/Line/Mode/bus";
    const response = await axios.get<object>(url);
    if (!response.data || Object.keys(response.data).length === 0) {
        throw new Error(`Did not recieve any data from bank tfl url: ${url}`);
    }
    const line_id_arr = [];
    let i = 0;
    do {
        line_id_arr.push(response.data[i].id);
        i++;
    } while (i < Object.keys(response.data).length);

    return line_id_arr;
};

const insertLineIds = async (dbClient: KyselyDb, lineIds: NewTflLine[]) => {
    logger.info("Insert funcction");
    const insertChunks = chunkArray(lineIds, 1000);
    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("tfl_line").values(chunk).execute()));
};

export const handler = async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");
    try {
        logger.info("Starting retrieval of TFL Line ID's");
        const lineIds = await getLineIds();

        await insertLineIds(dbClient, lineIds);

        logger.info("TFL line ID retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving tfl line Id's", e);
        }

        throw e;
    }
};
