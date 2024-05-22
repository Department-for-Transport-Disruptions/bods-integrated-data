import { sql } from "kysely";
import { KyselyDb, NewAvl } from "../database";
import { chunkArray } from "../utils";

export const insertAvls = async (dbClient: KyselyDb, avls: NewAvl[], fromBods?: boolean) => {
    const avlsWithGeom = avls.map<NewAvl>((avl) => ({
        ...avl,
        geom: sql`ST_SetSRID(ST_MakePoint(${avl.longitude}, ${avl.latitude}), 4326)`,
    }));

    const insertChunks = chunkArray(avlsWithGeom, 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto(fromBods ? "avl_bods" : "avl")
                .values(chunk)
                .execute(),
        ),
    );
};
