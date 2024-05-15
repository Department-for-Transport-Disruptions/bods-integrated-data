import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS postgis CASCADE`.execute(db);
    await db.schema
        .alterTable("avl")
        .addColumn("geom", sql`geometry(POINT, 4326)`)
        .execute();

    await sql`UPDATE avl SET geom = st_setsrid(st_makepoint(longitude, latitude), 4326)`.execute(db);
    await sql`CREATE INDEX idx_avl_geom ON avl USING GIST (geom)`.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
    await sql`DROP EXTENSION IF EXISTS postgis CASCADE`.execute(db);
    await db.schema.alterTable("avl").dropColumn("geom").execute();
    await db.schema.dropIndex("idx_avl_geom").on("avl").execute();
}
