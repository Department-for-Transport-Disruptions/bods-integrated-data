import { Database } from "@bods-integrated-data/shared/database";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
    await sql`
        ALTER TABLE avl
        ALTER COLUMN bearing TYPE float8
        USING bearing::float8
      `.execute(db);

    await sql`
          ALTER TABLE avl_bods
          ALTER COLUMN bearing TYPE float8
          USING bearing::float8
        `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
    await sql`
        ALTER TABLE avl
        ALTER COLUMN bearing TYPE text
        USING bearing::text
      `.execute(db);

    await sql`
          ALTER TABLE avl_bods
          ALTER COLUMN bearing TYPE text
          USING bearing::text
        `.execute(db);
}
