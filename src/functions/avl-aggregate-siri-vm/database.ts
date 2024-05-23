import { logger } from "@baselime/lambda-logger";
import { mapAvlDateStrings } from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb } from "@bods-integrated-data/shared/database";

export const getCurrentAvlData = async (dbClient: KyselyDb) => {
    logger.info("Getting data from avl table...");

    const avls = await dbClient
        .selectFrom("avl")
        .distinctOn(["operator_ref", "vehicle_ref"])
        .selectAll("avl")
        .orderBy(["operator_ref", "vehicle_ref", "response_time_stamp desc"])
        .execute();

    return avls.map(mapAvlDateStrings);
};
