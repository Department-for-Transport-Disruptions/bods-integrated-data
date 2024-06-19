import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("avl_onward_call").execute();

    await db.schema
        .createTable("avl_onward_call")
        .addColumn("id", "integer", (col) => col.primaryKey().generatedByDefaultAsIdentity())
        .addColumn("avl_id", "integer")
        .addColumn("stop_point_ref", "text")
        .addColumn("aimed_arrival_time", "timestamptz")
        .addColumn("expected_arrival_time", "timestamptz")
        .addColumn("aimed_departure_time", "timestamptz")
        .addColumn("expected_departure_time", "timestamptz")
        .addForeignKeyConstraint("avl_id_foreign", ["avl_id"], "avl", ["id"], (cb) => cb.onDelete("cascade"))
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("avl_onward_call").execute();

    await db.schema
        .createTable("avl_onward_call")
        .addColumn("id", "integer", (col) => col.primaryKey().generatedByDefaultAsIdentity())
        .addColumn("avl_id", "integer")
        .addColumn("stop_point_ref", "text")
        .addColumn("aimed_arrival_time", "timestamptz")
        .addColumn("expected_arrival_time", "timestamptz")
        .addColumn("aimed_departure_time", "timestamptz")
        .addColumn("expected_departure_time", "timestamptz")
        .addForeignKeyConstraint("avl_id_foreign", ["avl_id"], "avl", ["id"])
        .execute();
}
