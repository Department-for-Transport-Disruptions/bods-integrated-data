import { logger } from "@baselime/lambda-logger";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { avlSchema } from "@bods-integrated-data/shared/schema/siri.schema";
import { notEmpty } from "@bods-integrated-data/shared/utils";

export const getCurrentAvlData = async (db: KyselyDb) => {
    logger.info("Getting data from avl table...");

    const avl = await db
        .selectFrom("avl")
        .distinctOn(["operator_ref", "vehicle_ref"])
        .selectAll("avl")
        .orderBy(["operator_ref", "vehicle_ref", "response_time_stamp desc"])
        .execute();

    const parsedAvl = avl.map((record) => {
        const parsedAvl = avlSchema.safeParse(record);

        if (!parsedAvl.success) {
            logger.warn(`Invalid avl data in database. ID: ${record.id}`);
            logger.warn(`${JSON.stringify(parsedAvl.error)}`);
            return null;
        }

        return parsedAvl.data;
    });

    return parsedAvl.filter(notEmpty);
};
