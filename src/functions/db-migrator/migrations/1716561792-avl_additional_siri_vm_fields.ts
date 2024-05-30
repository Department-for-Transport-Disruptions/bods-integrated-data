import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .addColumn("vehicle_monitoring_ref", "text")
        .addColumn("destination_aimed_arrival_time", "timestamptz")
        .addColumn("ticket_machine_service_code", "text")
        .addColumn("journey_code", "text")
        .addColumn("vehicle_unique_id", "text")
        .addColumn("has_onward_calls", "boolean")
        .execute();

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

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable("avl")
        .dropColumn("vehicle_monitoring_ref")
        .dropColumn("destination_aimed_arrival_time")
        .dropColumn("ticket_machine_service_code")
        .dropColumn("journey_code")
        .dropColumn("vehicle_unique_id")
        .dropColumn("has_onward_calls")
        .execute();

    await db.schema.dropTable("avl_onward_call").execute();
}
