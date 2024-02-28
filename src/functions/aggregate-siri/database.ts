import { Kysely, sql } from "kysely";
import { Database } from "../../shared";
import { avlSchema } from "../../shared/schema/siri.schema";
import { notEmpty } from "../../shared/util";

export type Logger = {
    info: (message: string) => void;
    error: (message: string | Error) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
};
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
