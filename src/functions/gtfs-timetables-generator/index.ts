import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";

export const handler = async () => {
    try {
        const dbClient = await getDatabaseClient(process.env.IS_LOCAL === "true");

        logger.info("Starting GTFS Timetable Generator");

        const agencies = dbClient
            .selectFrom("agency_new")
            .select(["agency_new.id as agency_id", "agency_new.name as agency_name", "agency_new.url as agency_url"])
            .compile();

        await sql`
        SELECT * from aws_s3.query_export_to_s3('select * from ${sql.table()}', 
            aws_commons.create_s3_uri('sample-bucket', 'sample-filepath', 'us-west-2') 
        );`.execute(dbClient);

        logger.info("GTFS Timetable Generator successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the GTFS Timetable Generator", e);
        }

        throw e;
    }
};
