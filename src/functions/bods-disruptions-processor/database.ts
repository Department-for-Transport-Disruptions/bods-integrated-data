import { KyselyDb } from "@bods-integrated-data/shared/database";

export const getAgencies = (dbClient: KyselyDb, nocs: string[]) => {
    return dbClient.selectFrom("agency").selectAll().where("noc", "in", nocs).execute();
};

export const getRoutes = (dbClient: KyselyDb, lineRefs: string[]) => {
    return dbClient
        .selectFrom("route")
        .selectAll()
        .where("route_short_name", "in", lineRefs)
        .orderBy("id desc")
        .execute();
};
