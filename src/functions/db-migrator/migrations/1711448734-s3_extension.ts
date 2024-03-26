import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    if (process.env.IS_LOCAL !== "true") {
        await sql`CREATE EXTENSION aws_s3 CASCADE;`.execute(db);
    }
}

export async function down(db: Kysely<Database>): Promise<void> {
    if (process.env.IS_LOCAL !== "true") {
        await sql`DROP EXTENSION aws_s3 CASCADE;`.execute(db);
    }
}
