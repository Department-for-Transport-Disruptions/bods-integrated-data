import { Database } from "../../shared";
import { Kysely, sql } from "kysely";

export type Logger = {
    info: (message: string) => void;
    error: (message: string | Error) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
};
export const getCurrentAvlData = async (db: Kysely<Database>, logger: Logger) => {
    logger.info("Getting AVL data from avl table...");

    const avl = await db
        .selectFrom("avl")
        .selectAll("avl")
        .where(sql`"validUntilTime"::DATE`, ">=", sql<Date>`NOW()`)
        .execute()

    return avl
}
