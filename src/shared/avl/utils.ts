import { sql } from "kysely";
import { Avl, KyselyDb, NewAvl } from "../database";
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

/**
 * Maps AVL timestamp fields as ISO strings.
 * @param avl The AVL
 * @returns The AVL with date strings
 */
export const mapAvlDateStrings = <T extends Avl>(avl: T): T => ({
    ...avl,
    response_time_stamp: new Date(avl.response_time_stamp).toISOString(),
    recorded_at_time: new Date(avl.recorded_at_time).toISOString(),
    valid_until_time: new Date(avl.valid_until_time).toISOString(),
    origin_aimed_departure_time: avl.origin_aimed_departure_time
        ? new Date(avl.origin_aimed_departure_time).toISOString()
        : null,
});
