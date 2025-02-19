import { KyselyDb } from "@bods-integrated-data/shared/database";

export const getAgencies = (dbClient: KyselyDb, nocs: string[]) => {
    return dbClient.selectFrom("agency").selectAll().where("noc", "in", nocs).execute();
};

export const getRoutes = (dbClient: KyselyDb, lineIds: string[]) => {
    return dbClient.selectFrom("route").selectAll().where("line_id", "in", lineIds).execute();
};
