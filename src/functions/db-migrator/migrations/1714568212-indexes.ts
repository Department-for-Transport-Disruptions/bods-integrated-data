import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.createIndex("idx_trip_service_id").on("trip").column("service_id").execute();
    await db.schema.createIndex("idx_trip_route_id").on("trip").column("route_id").execute();
    await db.schema.createIndex("idx_trip_shape_id").on("trip").column("shape_id").execute();

    await db.schema.createIndex("idx_stop_time_trip_id").on("stop_time").column("trip_id").execute();
    await db.schema.createIndex("idx_stop_time_stop_id").on("stop_time").column("stop_id").execute();

    await db.schema.createIndex("idx_frequency_trip_id").on("frequency").column("trip_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropIndex("idx_trip_service_id").on("trip").execute();
    await db.schema.dropIndex("idx_trip_route_id").on("trip").execute();
    await db.schema.dropIndex("idx_trip_shape_id").on("trip").execute();

    await db.schema.dropIndex("idx_stop_time_trip_id").on("stop_time").execute();
    await db.schema.dropIndex("idx_stop_time_stop_id").on("stop_time").execute();

    await db.schema.dropIndex("idx_frequency_trip_id").on("frequency").execute();
}
