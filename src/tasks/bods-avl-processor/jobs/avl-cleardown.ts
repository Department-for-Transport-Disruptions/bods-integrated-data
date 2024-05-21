import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";

/* eslint-disable no-console */
void (async () => {
    console.time("avlcleardown");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        const result = await dbClient
            .deleteFrom("avl_bods")
            .where("avl_bods.valid_until_time", "<", sql<string>`NOW() - INTERVAL '2 minutes'`)
            .execute();

        console.log(`AVL cleardown successful, ${result[0].numDeletedRows} rows deleted`);

        console.timeEnd("avlcleardown");
    } catch (e) {
        if (e instanceof Error) {
            console.error("There was a problem with the AVL cleardown", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
