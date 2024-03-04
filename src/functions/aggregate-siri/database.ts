import { Database, Logger, notEmpty } from "@bods-integrated-data/shared";
import { avlSchema } from "@bods-integrated-data/shared/schema/siri.schema";
import { Kysely, sql } from "kysely";

export const getCurrentAvlData = async (db: Kysely<Database>, logger: Logger) => {
    logger.info("Getting data from avl table...");

    const avl = await db
        .selectFrom("avl")
        .distinctOn(["operatorRef", "vehicleRef"])
        .selectAll("avl")
        .orderBy(sql`"operatorRef", "vehicleRef", "responseTimeStamp" DESC`)
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
