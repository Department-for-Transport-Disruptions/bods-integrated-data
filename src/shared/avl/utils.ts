import { sql } from "kysely";
import { Avl, KyselyDb, NewAvl, NewAvlOnwardCall } from "../database";
import { chunkArray } from "../utils";
import { SiriSchemaTransformed } from "../schema";

export const AGGREGATED_SIRI_VM_FILE_PATH = "SIRI-VM.xml";

export const insertAvls = async (dbClient: KyselyDb, avls: NewAvl[], fromBods?: boolean) => {
    const avlsWithGeom = avls.map<NewAvl>((avl) => ({
        ...avl,
        geom: sql`ST_SetSRID
        (ST_MakePoint(
        ${avl.longitude},
        ${avl.latitude}
        ),
        4326
        )`,
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

export const insertAvlsWithOnwardCalls = async (dbClient: KyselyDb, avlsWithOnwardCalls: SiriSchemaTransformed) => {
    await Promise.all(
        avlsWithOnwardCalls.map(async ({ onward_calls, ...avl }) => {
            const avlWithGeom: NewAvl = {
                ...avl,
                geom: sql`ST_SetSRID
                (ST_MakePoint(
                ${avl.longitude},
                ${avl.latitude}
                ),
                4326
                )`,
            };

            const res = await dbClient.insertInto("avl").values(avlWithGeom).returning("avl.id").executeTakeFirst();

            const test_onward_calls = [
                {
                    stop_point_ref: "test1",
                    aimed_arrival_time: "2024-02-26T14:36:18+00:00",
                    expected_arrival_time: "2024-02-26T14:36:18+00:00",
                },
                {
                    stop_point_ref: "test2",
                    aimed_arrival_time: "2024-02-26T14:36:18+00:00",
                    expected_arrival_time: "2024-02-26T14:36:18+00:00",
                },
            ];

            if (!!onward_calls && !!res) {
                const onwardCalls: NewAvlOnwardCall[] = test_onward_calls.map((onwardCall) => ({
                    ...onwardCall,
                    avl_id: res.id,
                }));

                console.log("test", onwardCalls);
                await dbClient.insertInto("avl_onward_call").values(onwardCalls).execute();
            }
        }),
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
    destination_aimed_arrival_time: avl.destination_aimed_arrival_time
        ? new Date(avl.destination_aimed_arrival_time).toISOString()
        : null,
});
