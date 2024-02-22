import { Database } from "../../../shared";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("naptan_stop")
        .addColumn("atcoCode", "varchar(255)", (col) =>
            col.primaryKey().unique()
        )
        .addColumn("naptanCode", "varchar(255)")
        .addColumn("plateCode", "varchar(255)")
        .addColumn("cleardownCode", "varchar(255)")
        .addColumn("commonName", "varchar(255)")
        .addColumn("commonNameLang", "varchar(255)")
        .addColumn("shortCommonName", "varchar(255)")
        .addColumn("shortCommonNameLang", "varchar(255)")
        .addColumn("landmark", "varchar(255)")
        .addColumn("landmarkLang", "varchar(255)")
        .addColumn("street", "varchar(255)")
        .addColumn("streetLang", "varchar(255)")
        .addColumn("crossing", "varchar(255)")
        .addColumn("crossingLang", "varchar(255)")
        .addColumn("indicator", "varchar(255)")
        .addColumn("indicatorLang", "varchar(255)")
        .addColumn("bearing", "varchar(255)")
        .addColumn("nptgLocalityCode", "varchar(255)")
        .addColumn("localityName", "varchar(255)")
        .addColumn("parentLocalityName", "varchar(255)")
        .addColumn("grandParentLocalityName", "varchar(255)")
        .addColumn("town", "varchar(255)")
        .addColumn("townLang", "varchar(255)")
        .addColumn("suburb", "varchar(255)")
        .addColumn("suburbLang", "varchar(255)")
        .addColumn("localityCentre", "varchar(255)")
        .addColumn("gridType", "varchar(255)")
        .addColumn("easting", "varchar(255)")
        .addColumn("northing", "varchar(255)")
        .addColumn("longitude", "varchar(255)")
        .addColumn("latitude", "varchar(255)")
        .addColumn("stopType", "varchar(255)")
        .addColumn("busStopType", "varchar(255)")
        .addColumn("timingStatus", "varchar(255)")
        .addColumn("defaultWaitTime", "varchar(255)")
        .addColumn("notes", "varchar(255)")
        .addColumn("notesLang", "varchar(255)")
        .addColumn("administrativeAreaCode", "varchar(255)")
        .addColumn("creationDateTime", "varchar(255)")
        .addColumn("modificationDateTime", "varchar(255)")
        .addColumn("revisionNumber", "varchar(255)")
        .addColumn("modification", "varchar(255)")
        .addColumn("status", "varchar(255)")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("naptan_stop").execute();
}
