import { Database } from "@bods-integrated-data/shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("service")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("serviceCode", "text")
        .execute();

    await db.schema
        .createTable("calendar")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("serviceId", "integer")
        .addColumn("monday", "int2")
        .addColumn("tuesday", "int2")
        .addColumn("wednesday", "int2")
        .addColumn("thursday", "int2")
        .addColumn("friday", "int2")
        .addColumn("saturday", "int2")
        .addColumn("sunday", "int2")
        .addColumn("startDate", "text")
        .addColumn("endDate", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("service").execute();
    await db.schema.dropTable("calendar").execute();
}
