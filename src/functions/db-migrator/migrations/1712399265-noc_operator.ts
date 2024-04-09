import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("noc_operator")
        .addColumn("noc", "text", (col) => col.primaryKey())
        .addColumn("operator_public_name", "text")
        .addColumn("vosa_psv_license_name", "text")
        .addColumn("op_id", "text")
        .addColumn("pub_nm_id", "text")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("noc_operator").execute();
}
