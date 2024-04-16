import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("nptg_admin_area")
        .addColumn("admin_area_code", "text", (col) => col.primaryKey())
        .addColumn("atco_code", "text")
        .addColumn("name", "text")
        .execute();

    await db.schema
        .createTable("nptg_locality")
        .addColumn("locality_code", "text", (col) => col.primaryKey())
        .addColumn("admin_area_ref", "text")
        .execute();

    await db.schema
        .createTable("nptg_region")
        .addColumn("region_code", "text", (col) => col.primaryKey())
        .addColumn("name", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("nptg_admin_area").execute();
    await db.schema.dropTable("nptg_locality").execute();
    await db.schema.dropTable("nptg_region").execute();
}
