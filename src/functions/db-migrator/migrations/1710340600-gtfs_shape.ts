import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("shape")
        .addColumn("id", "integer", (col) => col.primaryKey().generatedByDefaultAsIdentity())
        .addColumn("shape_id", "text")
        .addColumn("shape_pt_lat", "float8")
        .addColumn("shape_pt_lon", "float8")
        .addColumn("shape_pt_sequence", "integer")
        .addColumn("shape_dist_traveled", "integer")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("shape").execute();
}
