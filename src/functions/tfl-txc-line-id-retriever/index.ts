import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";

let dbClient: KyselyDb;

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { STAGE: stage } = process.env;

    dbClient = dbClient || (await getDatabaseClient(stage === "local"));

    try {
        logger.info("Retrieving line ids");

        const lineIds = await dbClient.selectFrom("tfl_line").select("id").execute();

        return lineIds.map((line) => ({ lineId: line.id }));
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Error retrieving line ids");
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
