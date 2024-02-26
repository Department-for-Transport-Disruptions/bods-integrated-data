import { Database } from "../../../shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("avl")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("responseTimeStamp", "varchar(255)")
        .addColumn("producerRef", "varchar(255)")
        .addColumn("recordedAtTime", "varchar(255)")
        .addColumn("validUntilTime", "varchar(255)")
        .addColumn("lineRef", "varchar(255)")
        .addColumn("directionRef", "varchar(255)")
        .addColumn("operatorRef", "varchar(255)")
        .addColumn("datedVehicleJourneyRef", "varchar(255)")
        .addColumn("vehicleRef", "varchar(255)")
        .addColumn("dataSource", "varchar(255)")
        .addColumn("longitude", "varchar(255)")
        .addColumn("latitude", "varchar(255)")
        .addColumn("bearing", "varchar(255)")
        .addColumn("delay", "varchar(255)")
        .addColumn("isCompleteStopSequence", "varchar(255)")
        .addColumn("publishedLineName", "varchar(255)")
        .addColumn("originRef", "varchar(255)")
        .addColumn("destinationRef", "varchar(255)")
        .addColumn("blockRef", "varchar(255)")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("avl").execute();
}