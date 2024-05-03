import { Database } from "@bods-integrated-data/shared/database";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("stop").addColumn("region_code", "text").execute();

    await db.schema
        .createIndex("idx_naptan_stop_administrative_area_code")
        .on("naptan_stop")
        .column("administrative_area_code")
        .execute();

    await db.schema
        .createIndex("idx_naptan_stop_nptg_locality_code")
        .on("naptan_stop")
        .column("nptg_locality_code")
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.alterTable("stop").dropColumn("region_code").execute();

    await db.schema.dropIndex("idx_naptan_stop_administrative_area_code").on("naptan_stop").execute();
    await db.schema.dropIndex("idx_naptan_stop_nptg_locality_code").on("naptan_stop").execute();
}
