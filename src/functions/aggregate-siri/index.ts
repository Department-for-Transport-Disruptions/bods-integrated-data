import * as logger from "lambda-log";
import { randomUUID } from "crypto";
import { getCurrentAvlData } from "./database";
import { getDatabaseClient } from "../../shared";



export const handler = async () => {
    try {
        logger.options.dev = process.env.NODE_ENV !== "production";
        logger.options.debug =
        process.env.ENABLE_DEBUG_LOGS === "true" ||
        process.env.NODE_ENV !== "production";

        logger.options.meta = {
            id: randomUUID(),
        };

        logger.info("Starting SIRI-VM generator...");

        const db = await getDatabaseClient(process.env.IS_LOCAL === "true");

        const avl = await getCurrentAvlData(db, logger)

        console.log(JSON.stringify(avl))


    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);

            throw e;
        }

        throw e;
    }
};
