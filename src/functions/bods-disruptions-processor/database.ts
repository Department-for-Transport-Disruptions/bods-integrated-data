import { KyselyDb } from "@bods-integrated-data/shared/database";

export const getRoutes = (dbClient: KyselyDb, lineIds: string[]) => {
    return dbClient.selectFrom("route").selectAll().where("line_id", "in", lineIds).execute();
};
