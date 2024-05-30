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
}
