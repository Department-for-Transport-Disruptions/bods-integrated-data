import { logger } from "@baselime/lambda-logger";
import { KyselyDb } from "@bods-integrated-data/shared/database";

export const getCurrentAvlData = async (dbClient: KyselyDb) => {
    logger.info("Getting data from avl table...");

    return dbClient
        .selectFrom("avl")
        .distinctOn(["operator_ref", "vehicle_ref"])
        .selectAll("avl")
        .orderBy(["operator_ref", "vehicle_ref", "response_time_stamp desc"])
        .execute();
};
